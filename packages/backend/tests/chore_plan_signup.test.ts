import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import knexFactory, { Knex } from 'knex';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanSignupController from '../controllers/chore_plan_signup';
import RosterParticipantController from '../controllers/roster_participant';
import ChorePlanSignupError from '../utils/chorePlanSignupError';
import { shiftTimeRangesOverlap } from '../utils/shiftTime';
import {
  parseEmptyChorePlanSignupRequest,
  parseChorePlanShiftID,
  parseChorePlanSignupRequest,
  parseChorePlanSwitchRequest,
} from '../utils/chorePlanSignupInput';

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
  kind: 'chore' | 'event' | 'dinner';
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

interface BlockedQueryRow {
  blocked: boolean;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The signup test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The signup test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isSignupError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanSignupError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function waitForBlockedUserLock(
  database: Knex,
  applicationName: string,
  attemptsRemaining = 100,
): Promise<void> {
  const result = (await database.raw(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND application_name = ?
          AND state = 'active'
          AND wait_event_type = 'Lock'
          AND query ILIKE '%from "users"%'
          AND query ILIKE '%for update%'
      ) AS "blocked"
    `,
    [applicationName],
  )) as { rows: BlockedQueryRow[] };
  if (result.rows[0]?.blocked) {
    return;
  }
  if (attemptsRemaining <= 1) {
    assert.fail('Timed out waiting for signup to block on its user row.');
  }
  await delay(20);
  await waitForBlockedUserLock(
    database,
    applicationName,
    attemptsRemaining - 1,
  );
}

async function addParticipant(
  database: Knex,
  rosterID: number,
  userID: number,
  arrival = '2026-08-20T00:00:00.000Z',
  departure = '2026-09-10T00:00:00.000Z',
): Promise<void> {
  await database('roster_participants').insert({
    rosterID,
    userID,
    probabilityOfAttending: 100,
    estimatedArrivalDate: new Date(arrival),
    estimatedDepartureDate: new Date(departure),
    sleepingArrangement: 'Test fixture',
  });
}

test('signup input accepts only narrow positive shift contracts', () => {
  assert.deepEqual(parseChorePlanSignupRequest({ shiftIDs: [7, 8, 9] }), {
    shiftIDs: [7, 8, 9],
  });
  assert.deepEqual(
    parseChorePlanSwitchRequest({ fromShiftID: 7, toShiftID: 8 }),
    { fromShiftID: 7, toShiftID: 8 },
  );
  assert.equal(parseChorePlanShiftID('9'), 9);
  assert.equal(parseEmptyChorePlanSignupRequest(undefined), undefined);
  assert.equal(parseEmptyChorePlanSignupRequest({}), undefined);

  assert.throws(
    () => parseChorePlanSignupRequest({ shiftIDs: [7], force: true }),
    (error) => isSignupError(error, 400, /only shift IDs/i),
  );
  assert.throws(
    () => parseChorePlanSignupRequest({ shiftIDs: [0] }),
    (error) => isSignupError(error, 400, /valid chore plan shift/i),
  );
  assert.throws(
    () => parseChorePlanSignupRequest({ shiftIDs: ['7'] }),
    (error) => isSignupError(error, 400, /valid chore plan shift/i),
  );
  assert.throws(
    () => parseChorePlanSignupRequest({ shiftIDs: [7, 7] }),
    (error) => isSignupError(error, 400, /each chore plan shift once/i),
  );
  assert.throws(
    () => parseChorePlanSignupRequest({ shiftIDs: [1, 2, 3, 4] }),
    (error) => isSignupError(error, 400, /between 1 and 3/i),
  );
  assert.throws(
    () => parseEmptyChorePlanSignupRequest({ force: true }),
    (error) => isSignupError(error, 400, /does not accept request details/i),
  );
  assert.throws(
    () => parseChorePlanSwitchRequest({ fromShiftID: 7, toShiftID: 7 }),
    (error) => isSignupError(error, 400, /different destination/i),
  );
});

test(
  'signup, roster removal, and switching enforce lifecycle and integrity atomically',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_signup_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      const testDatabaseURL = new URL(databaseURL);
      testDatabaseURL.searchParams.set('application_name', schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: testDatabaseURL.toString(),
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
          { email: 'signup-primary@example.invalid' },
          { email: 'signup-capacity-a@example.invalid' },
          { email: 'signup-capacity-b@example.invalid' },
          { email: 'signup-overlap@example.invalid' },
          { email: 'signup-attendance@example.invalid' },
          { email: 'signup-outsider@example.invalid' },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const activeDatabase = database;
      await Promise.all(
        users
          .slice(0, 4)
          .map(({ id }) => addParticipant(activeDatabase, roster.id, id)),
      );
      await addParticipant(
        database,
        roster.id,
        users[4].id,
        '2026-09-05T00:00:00.000Z',
        '2026-09-10T00:00:00.000Z',
      );

      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);
      const signupController = new ChorePlanSignupController(database);
      await assert.rejects(
        signupController.signup(roster.id, [1], users[5].id),
        (error) => isSignupError(error, 403, /roster members/i),
      );
      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 3,
          requirements: { chore: 3, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      const generatedShifts = (await database(
        'chore_plan_generated_shifts as generated',
      )
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.kind',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', applied.draft.id)
        .orderBy('generated.kind')
        .orderBy('shift.startTime')
        .orderBy('shift.id')) as GeneratedShiftRow[];
      const choreShifts = generatedShifts.filter(
        ({ kind }) => kind === 'chore',
      );
      const batchShifts = choreShifts.reduce<GeneratedShiftRow[]>(
        (selected, candidate) =>
          selected.length < 3 &&
          selected.every(
            (selectedShift) =>
              !shiftTimeRangesOverlap(selectedShift, candidate),
          )
            ? [...selected, candidate]
            : selected,
        [],
      );
      assert(batchShifts.length >= 3);
      const [sourceShift, secondBatchShift, thirdBatchShift] = batchShifts;
      const capacityShift = choreShifts.find(({ id }) => id !== sourceShift.id);
      const overlappingShift = choreShifts.find(
        (candidate) =>
          candidate.id !== sourceShift.id &&
          shiftTimeRangesOverlap(sourceShift, candidate),
      );
      assert(capacityShift);
      assert(overlappingShift);

      await assert.rejects(
        signupController.signup(roster.id, [sourceShift.id], users[5].id),
        (error) => isSignupError(error, 403, /roster members/i),
      );
      await assert.rejects(
        signupController.signup(roster.id, [sourceShift.id], users[0].id),
        (error) => isSignupError(error, 409, /plan is open/i),
      );
      await lifecycleController.open(roster.id, users[0].id);

      let releaseUserLock = () => {};
      const userLockRelease = new Promise<void>((resolve) => {
        releaseUserLock = resolve;
      });
      let confirmUserLock = () => {};
      const userLockConfirmed = new Promise<void>((resolve) => {
        confirmUserLock = resolve;
      });
      const blockingTransaction = database.transaction(async (transaction) => {
        await transaction('users')
          .select('id')
          .where({ id: users[0].id })
          .forUpdate()
          .first();
        confirmUserLock();
        await userLockRelease;
      });
      await userLockConfirmed;
      const blockedSignup = signupController.signup(
        roster.id,
        [sourceShift.id],
        users[0].id,
      );
      try {
        await waitForBlockedUserLock(database, schemaName);
        await assert.rejects(
          database.transaction(async (transaction) => {
            await transaction.raw("SET LOCAL lock_timeout = '250ms'");
            await transaction('chore_plans')
              .select('id')
              .where({ id: applied.draft.id })
              .forUpdate()
              .first();
          }),
          (error: unknown) =>
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '55P03',
        );
      } finally {
        releaseUserLock();
        await blockingTransaction;
        await blockedSignup;
      }
      await signupController.remove(roster.id, sourceShift.id, users[0].id);

      await assert.rejects(
        signupController.signup(roster.id, [sourceShift.id], users[5].id),
        (error) => isSignupError(error, 403, /roster members/i),
      );
      await assert.rejects(
        signupController.signup(roster.id, [sourceShift.id], users[4].id),
        (error) => isSignupError(error, 409, /attendance window/i),
      );

      await database('chore_plans')
        .where({ id: applied.draft.id })
        .update({ choreRequirement: 2 });
      const batchShiftIDs = [
        sourceShift.id,
        secondBatchShift.id,
        thirdBatchShift.id,
      ].sort((first, second) => first - second);
      await assert.rejects(
        signupController.signup(roster.id, batchShiftIDs, users[0].id),
        (error) => isSignupError(error, 409, /all required chore/i),
      );
      assert.equal(
        Number(
          (
            await database('shift_participants')
              .where({ userID: users[0].id })
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        0,
      );
      await database('chore_plans')
        .where({ id: applied.draft.id })
        .update({ choreRequirement: 3 });
      const firstSignup = await signupController.signup(
        roster.id,
        batchShiftIDs,
        users[0].id,
      );
      assert.deepEqual(firstSignup, {
        changed: true,
        assignedShiftIDs: batchShiftIDs,
      });
      assert.deepEqual(
        await signupController.signup(roster.id, batchShiftIDs, users[0].id),
        { changed: false, assignedShiftIDs: batchShiftIDs },
      );
      await assert.rejects(
        signupController.signup(
          roster.id,
          [sourceShift.id, overlappingShift.id],
          users[3].id,
        ),
        (error) => isSignupError(error, 409, /another assignment/i),
      );
      assert.equal(
        Number(
          (
            await database('shift_participants')
              .where({ userID: users[3].id })
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        0,
      );
      await signupController.remove(
        roster.id,
        secondBatchShift.id,
        users[0].id,
      );
      await signupController.remove(roster.id, thirdBatchShift.id, users[0].id);
      await database('chore_plans')
        .where({ id: applied.draft.id })
        .update({ choreRequirement: 1 });

      const [ordinarySchedule] = (await database('schedules')
        .insert({
          rosterID: roster.id,
          name: 'Overlap fixture',
          description: 'Ordinary shift overlap fixture',
          chorePlanID: null,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      const [ordinaryShift] = (await database('shifts')
        .insert({
          scheduleID: ordinarySchedule.id,
          startTime: sourceShift.startTime,
          endTime: sourceShift.endTime,
          requiredParticipants: 10,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      await database('shift_participants').insert({
        shiftID: ordinaryShift.id,
        userID: users[3].id,
      });
      await assert.rejects(
        signupController.signup(roster.id, [sourceShift.id], users[3].id),
        (error) => isSignupError(error, 409, /another assignment/i),
      );

      const raceResults = await Promise.allSettled([
        signupController.signup(roster.id, [capacityShift.id], users[1].id),
        signupController.signup(roster.id, [capacityShift.id], users[2].id),
      ]);
      assert.equal(
        raceResults.filter(({ status }) => status === 'fulfilled').length,
        1,
      );
      assert.equal(
        raceResults.filter(({ status }) => status === 'rejected').length,
        1,
      );
      const rejectedRace = raceResults.find(
        ({ status }) => status === 'rejected',
      ) as PromiseRejectedResult;
      assert(isSignupError(rejectedRace.reason, 409, /shift is full/i));
      assert.equal(
        Number(
          (
            await database('shift_participants')
              .where({ shiftID: capacityShift.id })
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        capacityShift.requiredParticipants,
      );

      await assert.rejects(
        signupController.switch(
          roster.id,
          sourceShift.id,
          capacityShift.id,
          users[0].id,
        ),
        (error) => isSignupError(error, 409, /shift is full/i),
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: sourceShift.id, userID: users[0].id })
          .first(),
      );

      const capacityAssignment = await database('shift_participants')
        .where({ shiftID: capacityShift.id })
        .first();
      assert.deepEqual(
        await RosterParticipantController.RemoveFromRoster(
          roster.id,
          [Number(capacityAssignment.userID)],
          database,
        ),
        { deletedCount: 1, removedAssignmentCount: 1 },
      );
      assert.equal(
        await database('shift_participants')
          .where({
            shiftID: capacityShift.id,
            userID: Number(capacityAssignment.userID),
          })
          .first(),
        undefined,
      );
      assert.equal(
        await database('roster_participants')
          .where({
            rosterID: roster.id,
            userID: Number(capacityAssignment.userID),
          })
          .first(),
        undefined,
      );
      assert.deepEqual(
        await signupController.switch(
          roster.id,
          sourceShift.id,
          capacityShift.id,
          users[0].id,
        ),
        { changed: true, assignedShiftIDs: [capacityShift.id] },
      );
      assert.equal(
        await database('shift_participants')
          .where({ shiftID: sourceShift.id, userID: users[0].id })
          .first(),
        undefined,
      );
      await assert.rejects(
        signupController.switch(
          roster.id,
          sourceShift.id,
          thirdBatchShift.id,
          users[0].id,
        ),
        (error) => isSignupError(error, 409, /not assigned to the source/i),
      );

      assert.deepEqual(
        await signupController.remove(roster.id, capacityShift.id, users[0].id),
        { changed: true, assignedShiftIDs: [] },
      );
      assert.deepEqual(
        await signupController.remove(roster.id, capacityShift.id, users[0].id),
        { changed: false, assignedShiftIDs: [] },
      );

      await signupController.signup(roster.id, [sourceShift.id], users[0].id);
      const participantBeforeAttendanceUpdate = await database(
        'roster_participants',
      )
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where({ rosterID: roster.id, userID: users[0].id })
        .first();
      assert(participantBeforeAttendanceUpdate);
      const attendanceStartAfterShift = new Date(
        new Date(sourceShift.endTime).getTime() + 24 * 60 * 60 * 1000,
      );
      const attendanceEndAfterShift = new Date(
        attendanceStartAfterShift.getTime() + 60 * 60 * 1000,
      );
      await assert.rejects(
        database.transaction(async (transaction) => {
          await transaction('users')
            .select('id')
            .where({ id: users[0].id })
            .forUpdate()
            .first();
          await transaction('roster_participants')
            .where({ rosterID: roster.id, userID: users[0].id })
            .update({
              estimatedArrivalDate: attendanceStartAfterShift,
              estimatedDepartureDate: attendanceEndAfterShift,
            });
          assert.equal(
            await RosterParticipantController.ReconcileAttendanceWindow(
              transaction,
              roster.id,
              users[0].id,
              {
                startTime: attendanceStartAfterShift,
                endTime: attendanceEndAfterShift,
              },
            ),
            1,
          );
          throw new Error('Roll back attendance reconciliation fixture.');
        }),
        /roll back attendance reconciliation fixture/i,
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: sourceShift.id, userID: users[0].id })
          .first(),
      );
      const participantAfterRollback = await database('roster_participants')
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where({ rosterID: roster.id, userID: users[0].id })
        .first();
      assert.equal(
        new Date(participantAfterRollback.estimatedArrivalDate).getTime(),
        new Date(
          participantBeforeAttendanceUpdate.estimatedArrivalDate,
        ).getTime(),
      );
      assert.equal(
        new Date(participantAfterRollback.estimatedDepartureDate).getTime(),
        new Date(
          participantBeforeAttendanceUpdate.estimatedDepartureDate,
        ).getTime(),
      );

      assert.equal(
        await database.transaction(async (transaction) => {
          await transaction('users')
            .select('id')
            .where({ id: users[0].id })
            .forUpdate()
            .first();
          await transaction('roster_participants')
            .where({ rosterID: roster.id, userID: users[0].id })
            .update({
              estimatedArrivalDate: attendanceStartAfterShift,
              estimatedDepartureDate: attendanceEndAfterShift,
            });
          return RosterParticipantController.ReconcileAttendanceWindow(
            transaction,
            roster.id,
            users[0].id,
            {
              startTime: attendanceStartAfterShift,
              endTime: attendanceEndAfterShift,
            },
          );
        }),
        1,
      );
      assert.equal(
        await database('shift_participants')
          .where({ shiftID: sourceShift.id, userID: users[0].id })
          .first(),
        undefined,
      );
      await database('roster_participants')
        .where({ rosterID: roster.id, userID: users[0].id })
        .update({
          estimatedArrivalDate:
            participantBeforeAttendanceUpdate.estimatedArrivalDate,
          estimatedDepartureDate:
            participantBeforeAttendanceUpdate.estimatedDepartureDate,
        });

      await signupController.signup(roster.id, [sourceShift.id], users[0].id);
      await lifecycleController.close(roster.id, users[0].id);
      await assert.rejects(
        signupController.remove(roster.id, sourceShift.id, users[5].id),
        (error) => isSignupError(error, 403, /roster members/i),
      );
      await assert.rejects(
        signupController.remove(roster.id, sourceShift.id, users[0].id),
        (error) => isSignupError(error, 409, /plan is open/i),
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: sourceShift.id, userID: users[0].id })
          .first(),
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
