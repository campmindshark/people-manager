import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanAssignmentsController from '../controllers/chore_plan_assignments';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanRequirementsController from '../controllers/chore_plan_requirements';
import ChorePlanShiftsController from '../controllers/chore_plan_shifts';
import ChorePlanSignupController from '../controllers/chore_plan_signup';
import RosterController from '../controllers/roster';
import RoleConfigCollection from '../roles/role';
import ChorePlanAssignmentError from '../utils/chorePlanAssignmentError';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import ChorePlanRequirementError from '../utils/chorePlanRequirementError';
import {
  parseChorePlanRequirementOverrideClearRequest,
  parseChorePlanRequirementOverrideRequest,
  parseChorePlanRequirementParticipantID,
} from '../utils/chorePlanRequirementInput';
import ChorePlanSignupError from '../utils/chorePlanSignupError';

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

interface GeneratedShiftRow {
  id: number;
  stableKey: string;
  kind: 'chore' | 'event' | 'dinner';
  startTime: Date | string;
  endTime: Date | string;
}

interface DatabaseError {
  constraint?: string;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The requirement test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The requirement test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isRequirementError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanRequirementError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function addParticipant(
  database: Knex,
  rosterID: number,
  userID: number,
): Promise<void> {
  await database('roster_participants').insert({
    rosterID,
    userID,
    probabilityOfAttending: 100,
    estimatedArrivalDate: new Date('2026-08-20T00:00:00.000Z'),
    estimatedDepartureDate: new Date('2026-09-10T00:00:00.000Z'),
    sleepingArrangement: 'Test fixture',
  });
}

test('requirement override input is exact, bounded, and always reasoned', () => {
  assert.deepEqual(
    parseChorePlanRequirementOverrideRequest({
      requirements: { chore: 0, event: 20, dinner: 1 },
      reason: '  Accessibility accommodation  ',
    }),
    {
      requirements: { chore: 0, event: 20, dinner: 1 },
      reason: 'Accessibility accommodation',
    },
  );
  assert.deepEqual(
    parseChorePlanRequirementOverrideClearRequest({
      reason: '  Accommodation ended  ',
    }),
    { reason: 'Accommodation ended' },
  );
  assert.equal(parseChorePlanRequirementParticipantID('7'), 7);
  assert.throws(
    () =>
      parseChorePlanRequirementOverrideRequest({
        requirements: { chore: 0, event: 1, dinner: 1 },
        reason: '',
      }),
    (error) => isRequirementError(error, 400, /reason/i),
  );
  assert.throws(
    () =>
      parseChorePlanRequirementOverrideRequest({
        requirements: { chore: 0, event: 1, dinner: 1, force: true },
        reason: 'Invalid extra field',
      }),
    (error) => isRequirementError(error, 400, /only chore, event, and dinner/i),
  );
  assert.throws(
    () =>
      parseChorePlanRequirementOverrideRequest({
        requirements: { chore: 0, event: 21, dinner: 1 },
        reason: 'Out of bounds',
      }),
    (error) => isRequirementError(error, 400, /event.*0 to 20/i),
  );
  assert.throws(
    () =>
      parseChorePlanRequirementOverrideClearRequest({
        reason: 'Valid',
        force: true,
      }),
    (error) => isRequirementError(error, 400, /only a reason/i),
  );
  assert.throws(
    () => parseChorePlanRequirementParticipantID('1.5'),
    (error) => isRequirementError(error, 400, /valid roster participant/i),
  );

  const admin = RoleConfigCollection.getRoleByName('admin');
  assert(
    RoleConfigCollection.hasPermission(
      [admin.id],
      'chorePlans:overrideRequirements',
    ),
  );
  assert(
    !RoleConfigCollection.hasPermission([], 'chorePlans:overrideRequirements'),
  );
});

test(
  'participant overrides are plan-bound, audited, and shared by every assignment path',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_requirements_${Date.now()}`;
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
            email: 'requirement-admin@example.invalid',
          },
          {
            firstName: 'Alpha',
            lastName: 'Camper',
            playaName: 'A',
            email: 'requirement-alpha@example.invalid',
          },
          {
            firstName: 'Beta',
            lastName: 'Camper',
            playaName: 'B',
            email: 'requirement-beta@example.invalid',
          },
          {
            firstName: 'Outside',
            lastName: 'User',
            email: 'requirement-outsider@example.invalid',
          },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await addParticipant(database, roster.id, users[1].id);
      await addParticipant(database, roster.id, users[2].id);

      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);
      const requirementController = new ChorePlanRequirementsController(
        database,
      );
      const shiftController = new ChorePlanShiftsController(database);
      const signupController = new ChorePlanSignupController(database);
      const assignmentController = new ChorePlanAssignmentsController(database);
      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 2,
          requirements: { chore: 2, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: null,
        },
        users[0].id,
      );

      assert.deepEqual(await requirementController.getView(roster.id), {
        rosterID: roster.id,
        plan: {
          id: applied.draft.id,
          status: 'draft',
          requirements: { chore: 2, event: 1, dinner: 1 },
        },
        mutationsAllowed: true,
        participants: [
          {
            userID: users[1].id,
            firstName: 'Alpha',
            lastName: 'Camper',
            playaName: 'A',
            requirements: { chore: 2, event: 1, dinner: 1 },
            hasOverride: false,
            overrideReason: null,
          },
          {
            userID: users[2].id,
            firstName: 'Beta',
            lastName: 'Camper',
            playaName: 'B',
            requirements: { chore: 2, event: 1, dinner: 1 },
            hasOverride: false,
            overrideReason: null,
          },
        ],
      });
      await assert.rejects(
        requirementController.getView(roster.id + 1000),
        (error) => isRequirementError(error, 404, /roster not found/i),
      );
      await assert.rejects(
        requirementController.setOverride(
          roster.id,
          users[3].id,
          {
            requirements: { chore: 1, event: 1, dinner: 1 },
            reason: 'Not a roster member',
          },
          users[0].id,
        ),
        (error) => isRequirementError(error, 404, /participant not found/i),
      );
      await assert.rejects(
        requirementController.setOverride(
          roster.id,
          users[1].id,
          {
            requirements: { chore: 2, event: 1, dinner: 1 },
            reason: 'No reduction',
          },
          users[0].id,
        ),
        (error) => isRequirementError(error, 400, /at least one override/i),
      );
      await assert.rejects(
        requirementController.setOverride(
          roster.id,
          users[1].id,
          {
            requirements: { chore: 3, event: 1, dinner: 1 },
            reason: 'Above plan',
          },
          users[0].id,
        ),
        (error) => isRequirementError(error, 400, /plan value of 2/i),
      );

      const firstOverride = await requirementController.setOverride(
        roster.id,
        users[1].id,
        {
          requirements: { chore: 1, event: 1, dinner: 1 },
          reason: 'Accessibility accommodation',
        },
        users[0].id,
      );
      assert.equal(firstOverride.changed, true);
      assert.deepEqual(firstOverride.participant.requirements, {
        chore: 1,
        event: 1,
        dinner: 1,
      });
      assert.equal(
        (
          await requirementController.setOverride(
            roster.id,
            users[1].id,
            {
              requirements: { chore: 1, event: 1, dinner: 1 },
              reason: 'Accessibility accommodation',
            },
            users[0].id,
          )
        ).changed,
        false,
      );
      assert.equal(
        Number(
          (
            await database('chore_plan_audit_entries')
              .where({ action: 'participant_requirements_overridden' })
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        1,
      );
      const firstOverrideAudit = await database('chore_plan_audit_entries')
        .where({ action: 'participant_requirements_overridden' })
        .first();
      assert.deepEqual(firstOverrideAudit.details, {
        participantUserID: users[1].id,
        previousRequirements: { chore: 2, event: 1, dinner: 1 },
        requirements: { chore: 1, event: 1, dinner: 1 },
        previousReason: null,
        reason: 'Accessibility accommodation',
        removedAssignments: [],
      });

      await assert.rejects(
        draftController.apply(
          {
            rosterID: roster.id,
            camperCount: 2,
            requirements: { chore: 2, event: 0, dinner: 1 },
            expectedCatalogRevision: '1',
            expectedDraftRevision: applied.draft.draftRevision,
          },
          users[0].id,
        ),
        (error) =>
          error instanceof ChorePlanPreviewError &&
          error.status === 409 &&
          /override exceeds/i.test(error.message),
      );
      await assert.rejects(
        database('chore_plan_requirement_overrides').insert({
          chorePlanID: applied.draft.id,
          userID: users[2].id,
          choreRequirement: 3,
          eventRequirement: 1,
          dinnerRequirement: 1,
          reason: 'Invalid direct insert',
        }),
        (error: DatabaseError) =>
          error.constraint ===
          'chore_plan_requirement_overrides_plan_maximum_v2',
      );
      await assert.rejects(
        database('chore_plans')
          .where({ id: applied.draft.id })
          .update({ eventRequirement: 0 }),
        (error: DatabaseError) =>
          error.constraint === 'chore_plans_requirement_override_maxima_v2',
      );

      await requirementController.setOverride(
        roster.id,
        users[1].id,
        {
          requirements: { chore: 0, event: 1, dinner: 1 },
          reason: 'Full chore exemption',
        },
        users[0].id,
      );
      assert.deepEqual(
        (await shiftController.getForUser(roster.id, users[1].id)).plan
          ?.requirements,
        { chore: 0, event: 1, dinner: 1 },
      );

      await lifecycleController.open(roster.id, users[0].id);
      const shifts = (await database('chore_plan_generated_shifts as generated')
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.stableKey',
          'generated.kind',
          'shift.startTime',
          'shift.endTime',
        )
        .where('generated.chorePlanID', applied.draft.id)
        .where('generated.kind', 'chore')
        .orderBy('shift.startTime')) as GeneratedShiftRow[];
      const firstShift = shifts[0];
      const secondShift = shifts.find(
        (shift) =>
          shift.id !== firstShift.id &&
          new Date(shift.startTime).getTime() >=
            new Date(firstShift.endTime).getTime(),
      );
      assert(secondShift);
      const thirdShift = shifts.find(
        (shift) =>
          shift.id !== firstShift.id &&
          shift.id !== secondShift.id &&
          new Date(shift.startTime).getTime() >=
            new Date(secondShift.endTime).getTime(),
      );
      assert(thirdShift);
      await assert.rejects(
        signupController.signup(roster.id, [firstShift.id], users[1].id),
        (error) =>
          error instanceof ChorePlanSignupError &&
          error.status === 409 &&
          /all required chore/i.test(error.message),
      );
      await assert.rejects(
        assignmentController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        }),
        (error) =>
          error instanceof ChorePlanAssignmentError &&
          error.status === 409 &&
          /category requirement/i.test(error.message),
      );
      assert.deepEqual(
        (await assignmentController.getView(roster.id)).participants.find(
          ({ userID }) => userID === users[1].id,
        )?.requirements,
        { chore: 0, event: 1, dinner: 1 },
      );

      await database.raw(`
        CREATE FUNCTION reject_requirement_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'participant_requirements_cleared' THEN
            RAISE EXCEPTION 'forced requirement audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_requirement_audit_trigger
        BEFORE INSERT ON chore_plan_audit_entries
        FOR EACH ROW EXECUTE FUNCTION reject_requirement_audit();
      `);
      await assert.rejects(
        requirementController.clearOverride(
          roster.id,
          users[1].id,
          'Accommodation ended',
          users[0].id,
        ),
        /forced requirement audit failure/i,
      );
      assert(
        await database('chore_plan_requirement_overrides')
          .where({
            chorePlanID: applied.draft.id,
            userID: users[1].id,
          })
          .first(),
      );
      await database.raw(
        'DROP TRIGGER reject_requirement_audit_trigger ON chore_plan_audit_entries',
      );
      await database.raw('DROP FUNCTION reject_requirement_audit()');

      const cleared = await requirementController.clearOverride(
        roster.id,
        users[1].id,
        'Accommodation ended',
        users[0].id,
      );
      assert.equal(cleared.changed, true);
      assert.deepEqual(cleared.participant.requirements, {
        chore: 2,
        event: 1,
        dinner: 1,
      });
      assert.equal(
        (
          await requirementController.clearOverride(
            roster.id,
            users[1].id,
            'Already clear',
            users[0].id,
          )
        ).changed,
        false,
      );
      await signupController.signup(roster.id, [firstShift.id], users[1].id);
      await signupController.signup(roster.id, [secondShift.id], users[1].id);
      await assert.rejects(
        signupController.signup(roster.id, [thirdShift.id], users[1].id),
        (error) =>
          error instanceof ChorePlanSignupError &&
          error.status === 409 &&
          /all required chore/i.test(error.message),
      );

      await database.raw(`
        CREATE FUNCTION reject_requirement_reconciliation_audit()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'participant_requirements_overridden' THEN
            RAISE EXCEPTION 'forced reconciliation audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_requirement_reconciliation_audit_trigger
        BEFORE INSERT ON chore_plan_audit_entries
        FOR EACH ROW EXECUTE FUNCTION reject_requirement_reconciliation_audit();
      `);
      await assert.rejects(
        requirementController.setOverride(
          roster.id,
          users[1].id,
          {
            requirements: { chore: 1, event: 1, dinner: 1 },
            reason: 'Reduced participation',
          },
          users[0].id,
        ),
        /forced reconciliation audit failure/i,
      );
      assert.equal(
        Number(
          (
            await database('shift_participants as assignment')
              .innerJoin(
                'chore_plan_generated_shifts as generated',
                'generated.shiftID',
                'assignment.shiftID',
              )
              .where('assignment.userID', users[1].id)
              .where('generated.chorePlanID', applied.draft.id)
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        2,
      );
      assert.equal(
        await database('chore_plan_requirement_overrides')
          .where({ chorePlanID: applied.draft.id, userID: users[1].id })
          .first(),
        undefined,
      );
      await database.raw(
        'DROP TRIGGER reject_requirement_reconciliation_audit_trigger ON chore_plan_audit_entries',
      );
      await database.raw(
        'DROP FUNCTION reject_requirement_reconciliation_audit()',
      );

      await requirementController.setOverride(
        roster.id,
        users[1].id,
        {
          requirements: { chore: 1, event: 1, dinner: 1 },
          reason: 'Reduced participation',
        },
        users[0].id,
      );
      const retainedAssignments = await database(
        'shift_participants as assignment',
      )
        .innerJoin(
          'chore_plan_generated_shifts as generated',
          'generated.shiftID',
          'assignment.shiftID',
        )
        .select('assignment.shiftID')
        .where('assignment.userID', users[1].id)
        .where('generated.chorePlanID', applied.draft.id)
        .orderBy('assignment.id');
      assert.deepEqual(
        retainedAssignments.map(({ shiftID }) => Number(shiftID)),
        [firstShift.id],
      );
      const reconciliationAudit = await database('chore_plan_audit_entries')
        .where({ action: 'participant_requirements_overridden' })
        .orderBy('id', 'desc')
        .first();
      assert.deepEqual(reconciliationAudit.details, {
        participantUserID: users[1].id,
        previousRequirements: { chore: 2, event: 1, dinner: 1 },
        requirements: { chore: 1, event: 1, dinner: 1 },
        previousReason: null,
        reason: 'Reduced participation',
        removedAssignments: [
          {
            shiftID: secondShift.id,
            stableKey: secondShift.stableKey,
            kind: 'chore',
          },
        ],
      });

      const clearedAudit = await database('chore_plan_audit_entries')
        .where({ action: 'participant_requirements_cleared' })
        .first();
      assert.equal(clearedAudit.actorUserID, users[0].id);
      assert.deepEqual(clearedAudit.details, {
        participantUserID: users[1].id,
        previousRequirements: { chore: 0, event: 1, dinner: 1 },
        requirements: { chore: 2, event: 1, dinner: 1 },
        previousReason: 'Full chore exemption',
        reason: 'Accommodation ended',
        removedAssignments: [],
      });
      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'participant_requirements_cleared',
          details: {
            participantUserID: users[1].id,
            requirements: { chore: 2, event: 1, dinner: 1 },
            reason: 'Missing required audit fields',
          },
        }),
        /requirement_details_valid/i,
      );
      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'participant_requirements_overridden',
          details: {
            participantUserID: users[1].id,
            previousRequirements: { chore: 2, event: 1, dinner: 1 },
            requirements: { chore: '1', event: 1, dinner: 1 },
            previousReason: null,
            reason: 'Invalid requirement type',
            removedAssignments: [],
          },
        }),
        /requirement_details_valid/i,
      );
      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'participant_requirements_overridden',
          details: {
            participantUserID: users[1].id,
            previousRequirements: { chore: 2, event: 1, dinner: 1 },
            requirements: { chore: 21, event: 1, dinner: 1 },
            previousReason: null,
            reason: 'Invalid requirement range',
            removedAssignments: [],
          },
        }),
        /requirement_details_valid/i,
      );
      const validRemovedAssignment = {
        shiftID: secondShift.id,
        stableKey: secondShift.stableKey,
        kind: 'chore',
      };
      const validRequirementAuditDetails = {
        participantUserID: users[1].id,
        previousRequirements: { chore: 2, event: 1, dinner: 1 },
        requirements: { chore: 1, event: 1, dinner: 1 },
        previousReason: null,
        reason: 'Invalid removed assignment',
      };
      const constraintDatabase = database;
      await Promise.all(
        [
          [null],
          [{ ...validRemovedAssignment, shiftID: String(secondShift.id) }],
          [{ ...validRemovedAssignment, stableKey: 42 }],
          [{ ...validRemovedAssignment, kind: 'other' }],
          [{ ...validRemovedAssignment, unexpected: true }],
        ].map((removedAssignments) =>
          assert.rejects(
            constraintDatabase('chore_plan_audit_entries').insert({
              chorePlanID: applied.draft.id,
              actorUserID: users[0].id,
              action: 'participant_requirements_overridden',
              details: {
                ...validRequirementAuditDetails,
                removedAssignments,
              },
            }),
            /requirement_details_valid/i,
          ),
        ),
      );
      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'participant_requirements_cleared',
          details: {
            ...validRequirementAuditDetails,
            removedAssignments: [validRemovedAssignment],
          },
        }),
        /requirement_details_valid/i,
      );

      await lifecycleController.close(roster.id, users[0].id);
      assert.equal(
        (await requirementController.getView(roster.id)).mutationsAllowed,
        false,
      );
      await assert.rejects(
        requirementController.setOverride(
          roster.id,
          users[1].id,
          {
            requirements: { chore: 1, event: 1, dinner: 1 },
            reason: 'Closed plan attempt',
          },
          users[0].id,
        ),
        (error) => isRequirementError(error, 409, /plan is closed/i),
      );

      const [cleanupRoster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await addParticipant(database, cleanupRoster.id, users[2].id);
      const cleanupDraft = await draftController.apply(
        {
          rosterID: cleanupRoster.id,
          camperCount: 1,
          requirements: { chore: 2, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      await requirementController.setOverride(
        cleanupRoster.id,
        users[2].id,
        {
          requirements: { chore: 1, event: 1, dinner: 1 },
          reason: 'Temporary attendance accommodation',
        },
        users[0].id,
      );
      const cleanupAudit = await database('chore_plan_audit_entries')
        .where({
          chorePlanID: cleanupDraft.draft.id,
          action: 'participant_requirements_overridden',
        })
        .first();
      assert(cleanupAudit);

      await database.raw(`
        CREATE FUNCTION reject_roster_requirement_audit()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'participant_requirements_cleared'
            AND NEW.details ->> 'reason' = 'Roster membership ended.'
          THEN
            RAISE EXCEPTION 'forced roster requirement audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER reject_roster_requirement_audit_trigger
        BEFORE INSERT ON chore_plan_audit_entries
        FOR EACH ROW EXECUTE FUNCTION reject_roster_requirement_audit();
      `);
      await assert.rejects(
        RosterController.UnregisterParticipantFromRoster(
          cleanupRoster.id,
          users[2].id,
          users[0].id,
          database,
        ),
        /forced roster requirement audit failure/i,
      );
      assert(
        await database('roster_participants')
          .where({ rosterID: cleanupRoster.id, userID: users[2].id })
          .first(),
      );
      assert(
        await database('chore_plan_requirement_overrides')
          .where({
            chorePlanID: cleanupDraft.draft.id,
            userID: users[2].id,
          })
          .first(),
      );
      await database.raw(
        'DROP TRIGGER reject_roster_requirement_audit_trigger ON chore_plan_audit_entries',
      );
      await database.raw('DROP FUNCTION reject_roster_requirement_audit()');

      assert.equal(
        await RosterController.UnregisterParticipantFromRoster(
          cleanupRoster.id,
          users[2].id,
          users[0].id,
          database,
        ),
        true,
      );
      assert.equal(
        await database('chore_plan_requirement_overrides')
          .where({
            chorePlanID: cleanupDraft.draft.id,
            userID: users[2].id,
          })
          .first(),
        undefined,
      );
      assert(
        await database('chore_plan_audit_entries')
          .where({ id: cleanupAudit.id })
          .first(),
      );
      const cleanupClearAudit = await database('chore_plan_audit_entries')
        .where({
          chorePlanID: cleanupDraft.draft.id,
          action: 'participant_requirements_cleared',
        })
        .orderBy('id', 'desc')
        .first();
      assert(cleanupClearAudit);
      assert.equal(cleanupClearAudit.actorUserID, users[0].id);
      assert.deepEqual(cleanupClearAudit.details, {
        participantUserID: users[2].id,
        previousRequirements: { chore: 1, event: 1, dinner: 1 },
        requirements: { chore: 2, event: 1, dinner: 1 },
        previousReason: 'Temporary attendance accommodation',
        reason: 'Roster membership ended.',
        removedAssignments: [],
      });

      await addParticipant(database, cleanupRoster.id, users[2].id);
      const rejoinedParticipant = (
        await requirementController.getView(cleanupRoster.id)
      ).participants.find(({ userID }) => userID === users[2].id);
      assert.deepEqual(rejoinedParticipant, {
        userID: users[2].id,
        firstName: 'Beta',
        lastName: 'Camper',
        playaName: 'B',
        requirements: { chore: 2, event: 1, dinner: 1 },
        hasOverride: false,
        overrideReason: null,
      });

      const reducedCleanupDraft = await draftController.apply(
        {
          rosterID: cleanupRoster.id,
          camperCount: 1,
          requirements: { chore: 0, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: cleanupDraft.draft.draftRevision,
        },
        users[0].id,
      );
      assert.equal(reducedCleanupDraft.changed, true);
      assert.deepEqual(reducedCleanupDraft.draft.requirements, {
        chore: 0,
        event: 1,
        dinner: 1,
      });
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
