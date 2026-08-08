import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import { loadChorePlanParticipantSignupStatus } from '../controllers/chore_plan_participant_status';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanReadinessController from '../controllers/chore_plan_readiness';
import ChorePlanRequirementsController from '../controllers/chore_plan_requirements';
import RoleConfigCollection from '../roles/role';
import ChorePlanReadinessError from '../utils/chorePlanReadinessError';
import {
  NewPlaceholderSignupStatus,
  signupStatusIssues,
} from '../view_models/signup_status';

const TEST_DATABASE_URL = process.env.CHORE_TEARDOWN_TEST_DATABASE_URL;
const POSTGRES_TEST_OPTIONS = {
  skip: TEST_DATABASE_URL
    ? false
    : 'CHORE_TEARDOWN_TEST_DATABASE_URL is not configured.',
  timeout: 120_000,
};

interface IDRow {
  id: number;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The readiness test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The readiness test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isReadinessError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanReadinessError &&
    error.status === status &&
    message.test(error.message)
  );
}

test('participant messaging uses effective category requirements only while open', () => {
  const status = NewPlaceholderSignupStatus();
  Object.assign(status, {
    hasSignedUpForRoster: true,
    hasCompletedPrivateProfile: true,
    hasCompletedPublicProfile: true,
    isVerified: true,
    chorePlanStatus: 'open',
    choreSignupsOpen: true,
    requirements: { chore: 2, event: 1, dinner: 1 },
    choreShiftCount: 1,
    eventShiftCount: 1,
    dinnerShiftCount: 0,
  });

  assert.deepEqual(signupStatusIssues(status), [
    'Chore signups are open. You still need to sign up for 1 chore shift and 1 dinner shift.',
  ]);
  status.choreSignupsOpen = false;
  status.chorePlanStatus = 'closed';
  assert.deepEqual(signupStatusIssues(status), []);

  const exempt = NewPlaceholderSignupStatus();
  Object.assign(exempt, {
    hasSignedUpForRoster: true,
    hasCompletedPrivateProfile: true,
    hasCompletedPublicProfile: true,
    isVerified: true,
    chorePlanStatus: 'open',
    choreSignupsOpen: true,
    requirements: { chore: 0, event: 0, dinner: 0 },
  });
  assert.deepEqual(signupStatusIssues(exempt), []);
});

test('the administrator role has the separate readiness permission', () => {
  const admin = RoleConfigCollection.getRoleByName('admin');
  assert(
    RoleConfigCollection.hasPermission([admin.id], 'chorePlans:readiness'),
  );
  assert(!RoleConfigCollection.hasPermission([], 'chorePlans:readiness'));
});

test(
  'readiness aggregates unique generated shifts, exceptions, profiles, attendance, and participant messaging',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_readiness_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: { extension: 'ts', tableName: 'knex_migrations' },
        pool: { max: 8, min: 0 },
        searchPath: [schemaName],
      });
      await database.migrate.latest({
        directory: path.resolve(__dirname, '../migrations'),
        extension: 'ts',
      });

      const users = (await database('users')
        .insert([
          {
            firstName: 'Admin',
            lastName: 'Actor',
            email: 'readiness-admin@example.invalid',
          },
          {
            firstName: 'Alpha',
            lastName: 'Camper',
            playaName: 'Ace',
            email: 'readiness-alpha@example.invalid',
            phoneNumber: '555-0101',
            location: 'Test City',
          },
          {
            firstName: 'Beta',
            lastName: 'Camper',
            email: 'readiness-beta@example.invalid',
          },
          {
            firstName: 'Gamma',
            lastName: 'Camper',
            email: 'readiness-gamma@example.invalid',
            phoneNumber: '555-0103',
            location: 'Test City',
          },
        ])
        .returning('id')) as IDRow[];
      await database('private_profiles').insert([
        {
          userID: users[1].id,
          emergencyContactName: 'Alpha Contact',
          emergencyContactPhone: '555-1001',
        },
        {
          userID: users[3].id,
          emergencyContactName: 'Gamma Contact',
          emergencyContactPhone: '555-1003',
        },
      ]);
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await database('roster_participants').insert([
        {
          rosterID: roster.id,
          userID: users[1].id,
          probabilityOfAttending: 100,
          estimatedArrivalDate: new Date('2026-08-20T00:00:00.000Z'),
          estimatedDepartureDate: new Date('2026-09-10T00:00:00.000Z'),
          sleepingArrangement: 'Test fixture',
        },
        {
          rosterID: roster.id,
          userID: users[2].id,
          probabilityOfAttending: 100,
          estimatedArrivalDate: new Date('2026-08-25T00:00:00.000Z'),
          estimatedDepartureDate: new Date('2026-08-25T00:00:00.000Z'),
          sleepingArrangement: 'Test fixture',
        },
        {
          rosterID: roster.id,
          userID: users[3].id,
          probabilityOfAttending: 100,
          estimatedArrivalDate: new Date('2026-08-20T00:00:00.000Z'),
          estimatedDepartureDate: new Date('2026-09-10T00:00:00.000Z'),
          sleepingArrangement: 'Test fixture',
        },
      ]);

      const readinessController = new ChorePlanReadinessController(database);
      await assert.rejects(
        readinessController.getByRosterID(roster.id + 1000),
        (error) => isReadinessError(error, 404, /roster not found/i),
      );
      await assert.rejects(
        readinessController.getByRosterID(roster.id),
        (error) => isReadinessError(error, 404, /create the chore plan/i),
      );

      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);
      const requirementController = new ChorePlanRequirementsController(
        database,
      );
      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 3,
          requirements: { chore: 2, event: 1, dinner: 1 },
          expectedCatalogRevision: '2',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      await requirementController.setOverride(
        roster.id,
        users[3].id,
        {
          requirements: { chore: 0, event: 0, dinner: 0 },
          reason: 'Accessibility exemption',
        },
        users[0].id,
      );
      await lifecycleController.open(roster.id, users[0].id);

      const assignedShift = await database(
        'chore_plan_generated_shifts as generated',
      )
        .select('generated.shiftID')
        .where('generated.chorePlanID', applied.draft.id)
        .where('generated.kind', 'chore')
        .orderBy('generated.shiftID')
        .first();
      assert(assignedShift);
      await database('shift_participants').insert({
        shiftID: assignedShift.shiftID,
        userID: users[1].id,
      });

      const auditCountBefore = Number(
        (
          await database('chore_plan_audit_entries')
            .where('chorePlanID', applied.draft.id)
            .count('* as count')
            .first()
        )?.count ?? 0,
      );
      const readiness = await readinessController.getByRosterID(roster.id);
      const auditCountAfter = Number(
        (
          await database('chore_plan_audit_entries')
            .where('chorePlanID', applied.draft.id)
            .count('* as count')
            .first()
        )?.count ?? 0,
      );

      assert.equal(readiness.status, 'open');
      assert.equal(readiness.plannerHeadcount, 3);
      assert.equal(readiness.actualRosterCount, 3);
      assert.equal(readiness.headcountDifference, 0);
      assert.deepEqual(readiness.categories.chore, {
        kind: 'chore',
        completeParticipants: 1,
        incompleteParticipants: 2,
        assignedShifts: 1,
        requiredShifts: 4,
      });
      assert.deepEqual(
        readiness.incompleteParticipants.find(
          ({ userID }) => userID === users[1].id,
        )?.missing,
        { chore: 1, event: 1, dinner: 1 },
      );
      assert.deepEqual(
        readiness.participantDataIssues.find(
          ({ userID }) => userID === users[2].id,
        )?.missing,
        ['public_profile', 'private_profile', 'attendance_window'],
      );
      assert.deepEqual(
        readiness.feasibilityIssues
          .filter(({ userID }) => userID === users[2].id)
          .map(({ reason }) => reason),
        ['missing_attendance', 'missing_attendance', 'missing_attendance'],
      );
      assert.deepEqual(readiness.requirementExceptions, [
        {
          userID: users[3].id,
          name: 'Gamma C.',
          type: 'exemption',
          requirements: { chore: 0, event: 0, dinner: 0 },
          reason: 'Accessibility exemption',
        },
      ]);
      assert.equal(
        readiness.underfilledShifts.length +
          readiness.fullShifts.length +
          readiness.overfilledShifts.length,
        await database('chore_plan_generated_shifts')
          .where('chorePlanID', applied.draft.id)
          .count('* as count')
          .first()
          .then((row) => Number(row?.count ?? 0)),
      );
      assert(Number.isFinite(new Date(readiness.generatedAt).getTime()));
      assert.equal(auditCountAfter, auditCountBefore);

      const alphaStatus = await loadChorePlanParticipantSignupStatus(
        database,
        users[1].id,
        roster.id,
      );
      assert.deepEqual(alphaStatus, {
        chorePlanStatus: 'open',
        choreSignupsOpen: true,
        requirements: { chore: 2, event: 1, dinner: 1 },
        hasCustomRequirements: false,
        requirementExceptionReason: null,
        choreShiftCount: 1,
        eventShiftCount: 0,
        dinnerShiftCount: 0,
        shiftCount: 1,
      });
      const gammaStatus = await loadChorePlanParticipantSignupStatus(
        database,
        users[3].id,
        roster.id,
      );
      assert.deepEqual(gammaStatus?.requirements, {
        chore: 0,
        event: 0,
        dinner: 0,
      });
      assert.equal(gammaStatus?.hasCustomRequirements, true);
      assert.equal(
        gammaStatus?.requirementExceptionReason,
        'Accessibility exemption',
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
