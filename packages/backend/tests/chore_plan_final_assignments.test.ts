import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanFinalAssignmentsController from '../controllers/chore_plan_final_assignments';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanFinalAssignmentsError from '../utils/chorePlanFinalAssignmentsError';

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
    'The final-assignment test only runs against PostgreSQL locally.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The final-assignment test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isFinalAssignmentsError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanFinalAssignmentsError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function addRosterParticipant(
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

test(
  'final assignments require a closed plan and return a stable private roster snapshot',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_final_assignments_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: { extension: 'ts', tableName: 'knex_migrations' },
        pool: { max: 6, min: 0 },
        searchPath: [schemaName],
      });
      await database.migrate.latest({
        directory: path.resolve(__dirname, '../migrations'),
        extension: 'ts',
      });

      const users = (await database('users')
        .insert([
          {
            firstName: 'Zoe',
            lastName: 'Zebra',
            playaName: 'bravo',
            email: 'final-member@example.invalid',
          },
          {
            firstName: 'Amy',
            lastName: 'Yellow',
            playaName: 'Alpha',
            email: 'final-other@example.invalid',
          },
          {
            firstName: 'Outside',
            lastName: 'Person',
            email: 'final-outsider@example.invalid',
          },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await addRosterParticipant(database, roster.id, users[0].id);
      await addRosterParticipant(database, roster.id, users[1].id);

      const controller = new ChorePlanFinalAssignmentsController(database);
      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);

      await assert.rejects(
        controller.getForUser(roster.id + 1000, users[0].id),
        (error) => isFinalAssignmentsError(error, 404, /roster not found/i),
      );
      await assert.rejects(
        controller.getForUser(roster.id, users[2].id),
        (error) => isFinalAssignmentsError(error, 403, /roster members/i),
      );
      await assert.rejects(
        controller.getForUser(roster.id, users[0].id),
        (error) => isFinalAssignmentsError(error, 404, /no chore plan/i),
      );

      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      await assert.rejects(
        controller.getForUser(roster.id, users[0].id),
        (error) => isFinalAssignmentsError(error, 409, /after.*close/i),
      );

      await lifecycleController.open(roster.id, users[0].id);
      await assert.rejects(
        controller.getForUser(roster.id, users[0].id),
        (error) => isFinalAssignmentsError(error, 409, /after.*close/i),
      );

      const generatedShifts = await database(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'generated.shiftID',
          'generated.stableKey',
          'generated.kind',
          'generated.displayDayNumber',
          'generated.scheduleKey',
          'shift.startTime',
        )
        .where('generated.chorePlanID', applied.draft.id)
        .orderBy('generated.displayDayNumber')
        .orderBy('shift.startTime')
        .orderBy('generated.scheduleKey')
        .orderBy('generated.stableKey');
      const choreShifts = generatedShifts.filter(
        ({ kind }) => kind === 'chore',
      );
      assert(choreShifts.length >= 1);
      await database('shift_participants').insert([
        { shiftID: choreShifts[0].shiftID, userID: users[0].id },
        { shiftID: choreShifts[0].shiftID, userID: users[1].id },
      ]);
      await lifecycleController.close(roster.id, users[0].id);

      const auditCountBefore = Number(
        (await database('chore_plan_audit_entries').count('* as count').first())
          ?.count ?? 0,
      );
      const response = await controller.getForUser(roster.id, users[0].id);
      const repeatedResponse = await controller.getForUser(
        roster.id,
        users[0].id,
      );
      assert.deepEqual(repeatedResponse, response);
      assert.equal(response.rosterID, roster.id);
      assert.equal(response.planID, applied.draft.id);
      assert.equal(response.status, 'closed');
      assert.equal(response.planningYear, 2026);
      assert(Number.isFinite(new Date(response.closedAt).getTime()));
      assert.equal(response.assignmentCount, 2);
      assert.deepEqual(
        response.categories.map(({ kind }) => kind),
        ['chore', 'event', 'dinner'],
      );
      assert.deepEqual(
        response.categories.flatMap(({ shifts }) => shifts).length,
        generatedShifts.length,
      );
      const firstAssignedShift = response.categories[0].shifts.find(
        ({ id }) => id === Number(choreShifts[0].shiftID),
      );
      assert(firstAssignedShift);
      assert.deepEqual(firstAssignedShift.participants, [
        { displayName: 'Alpha (Amy Y.)', currentUser: false },
        { displayName: 'bravo (Zoe Z.)', currentUser: true },
      ]);
      assert.deepEqual(
        response.categories[0].shifts.map(({ stableKey }) => stableKey),
        generatedShifts
          .filter(({ kind }) => kind === 'chore')
          .map(({ stableKey }) => stableKey),
      );
      const serialized = JSON.stringify(response);
      assert.equal(serialized.includes('userID'), false);
      assert.equal(serialized.includes('@example.invalid'), false);
      assert.equal(serialized.includes('Yellow'), false);
      assert.equal(serialized.includes('Zebra'), false);
      assert.equal(serialized.includes('catalogRevision'), false);
      assert.equal(
        Number(
          (
            await database('chore_plan_audit_entries')
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        auditCountBefore,
      );

      await database('shift_participants')
        .whereIn(
          'shiftID',
          generatedShifts.map(({ shiftID }) => shiftID),
        )
        .delete();
      const emptyResponse = await controller.getForUser(roster.id, users[0].id);
      assert.equal(emptyResponse.assignmentCount, 0);
      assert(
        emptyResponse.categories
          .flatMap(({ shifts }) => shifts)
          .every(({ participants }) => participants.length === 0),
      );

      await lifecycleController.reopen(
        roster.id,
        users[0].id,
        'Correct assignments',
      );
      await assert.rejects(
        controller.getForUser(roster.id, users[0].id),
        (error) => isFinalAssignmentsError(error, 409, /after.*close/i),
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
