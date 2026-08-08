import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanShiftsController from '../controllers/chore_plan_shifts';
import ChorePlanShiftViewError from '../utils/chorePlanShiftViewError';
import { prepareRosterAttendanceTimestampWrite } from '../utils/rosterAttendanceTime';
import { CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES } from '../view_models/chore_plan_shifts';

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
    'The shift-view test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The shift-view test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isShiftViewError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanShiftViewError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function addRosterParticipant(
  database: Knex,
  rosterID: number,
  userID: number,
): Promise<void> {
  const attendanceTimestampWrite = await prepareRosterAttendanceTimestampWrite(
    database,
    new Date('2026-08-20T00:00:00.000Z'),
    new Date('2026-09-10T00:00:00.000Z'),
  );

  await database('roster_participants').insert({
    rosterID,
    userID,
    probabilityOfAttending: 100,
    ...attendanceTimestampWrite,
    sleepingArrangement: 'Test fixture',
  });
}

test(
  'member shift view keeps drafts private and open or closed plans read-only',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_shifts_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: { extension: 'ts', tableName: 'knex_migrations' },
        pool: { max: 5, min: 0 },
        searchPath: [schemaName],
      });
      await database.migrate.latest({
        directory: path.resolve(__dirname, '../migrations'),
        extension: 'ts',
      });

      const [member] = (await database('users')
        .insert({
          email: 'shift-view-member@example.invalid',
          firstName: 'Mara',
          lastName: 'Moon',
          playaName: 'Moonbeam',
        })
        .returning('id')) as IDRow[];
      const [otherMember] = (await database('users')
        .insert({
          email: 'shift-view-other@example.invalid',
          firstName: 'Alex',
          lastName: 'Rivera',
          playaName: '',
        })
        .returning('id')) as IDRow[];
      const [unassignedMember] = (await database('users')
        .insert({ email: 'shift-view-unassigned@example.invalid' })
        .returning('id')) as IDRow[];
      const [outsider] = (await database('users')
        .insert({ email: 'shift-view-outsider@example.invalid' })
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await addRosterParticipant(database, roster.id, member.id);
      await addRosterParticipant(database, roster.id, otherMember.id);
      await addRosterParticipant(database, roster.id, unassignedMember.id);

      const shiftsController = new ChorePlanShiftsController(database);
      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);

      await assert.rejects(
        shiftsController.getForUser(roster.id + 1000, member.id),
        (error) => isShiftViewError(error, 404, /roster not found/i),
      );
      await assert.rejects(
        shiftsController.getForUser(roster.id, outsider.id),
        (error) => isShiftViewError(error, 403, /roster members/i),
      );

      assert.deepEqual(
        await shiftsController.getForUser(roster.id, member.id),
        {
          rosterID: roster.id,
          plan: null,
          selfServiceMutationsAllowed: false,
          shifts: [],
        },
      );

      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
          expectedCatalogRevision: '2',
          expectedDraftRevision: null,
        },
        member.id,
      );
      const draftView = await shiftsController.getForUser(roster.id, member.id);
      assert.equal(draftView.plan?.status, 'draft');
      assert.deepEqual(draftView.plan?.requirements, {
        chore: 1,
        event: 1,
        dinner: 1,
      });
      assert.equal(draftView.selfServiceMutationsAllowed, false);
      assert.deepEqual(draftView.shifts, []);

      await lifecycleController.open(roster.id, member.id);
      const generatedShift = await database('chore_plan_generated_shifts')
        .select('shiftID')
        .where({ chorePlanID: applied.draft.id })
        .orderBy('shiftID')
        .first();
      assert(generatedShift);
      await database('shift_participants').insert([
        { shiftID: generatedShift.shiftID, userID: member.id },
        { shiftID: generatedShift.shiftID, userID: otherMember.id },
      ]);

      const openView = await shiftsController.getForUser(roster.id, member.id);
      assert.equal(openView.plan?.status, 'open');
      assert.equal(openView.selfServiceMutationsAllowed, true);
      assert(openView.shifts.length > 0);
      assert.deepEqual(
        new Set(openView.shifts.map(({ kind }) => kind)),
        new Set(['chore', 'event', 'dinner']),
      );
      const assignedShift = openView.shifts.find(
        ({ id }) => id === generatedShift.shiftID,
      );
      assert(assignedShift);
      assert.equal(assignedShift.assignedParticipantCount, 2);
      assert.equal(assignedShift.currentUserAssigned, true);
      assert.deepEqual(assignedShift.assignments, [
        { displayName: 'Moonbeam', currentUser: true },
        { displayName: 'Alex R.', currentUser: false },
      ]);
      assert.equal(
        assignedShift.slots.length,
        assignedShift.requiredParticipants,
      );
      assert.equal(JSON.stringify(openView).includes('userID'), false);
      assert.equal(
        JSON.stringify(openView).includes('@example.invalid'),
        false,
      );

      const unassignedMemberView = await shiftsController.getForUser(
        roster.id,
        unassignedMember.id,
      );
      assert.equal(
        unassignedMemberView.shifts.find(
          ({ id }) => id === generatedShift.shiftID,
        )?.currentUserAssigned,
        false,
      );
      assert.deepEqual(
        unassignedMemberView.shifts.find(
          ({ id }) => id === generatedShift.shiftID,
        )?.assignments,
        [
          { displayName: 'Moonbeam', currentUser: false },
          { displayName: 'Alex R.', currentUser: false },
        ],
      );

      const availableShift = openView.shifts.find(
        ({ id, assignedParticipantCount, requiredParticipants }) =>
          id !== generatedShift.shiftID &&
          assignedParticipantCount < requiredParticipants,
      );
      assert(availableShift);
      const restrictedAttendanceTimestampWrite =
        await prepareRosterAttendanceTimestampWrite(
          database,
          new Date(availableShift.endTime),
          new Date('2026-09-10T00:00:00.000Z'),
        );
      await database('roster_participants')
        .where({ rosterID: roster.id, userID: unassignedMember.id })
        .update(restrictedAttendanceTimestampWrite);
      const attendanceRestrictedView = await shiftsController.getForUser(
        roster.id,
        unassignedMember.id,
      );
      assert.equal(
        attendanceRestrictedView.shifts.find(
          ({ id }) => id === availableShift.id,
        )?.signupRestrictionReason,
        CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow,
      );

      const restoredAttendanceTimestampWrite =
        await prepareRosterAttendanceTimestampWrite(
          database,
          new Date('2026-08-20T00:00:00.000Z'),
          new Date('2026-09-10T00:00:00.000Z'),
        );
      await database('roster_participants')
        .where({ rosterID: roster.id, userID: unassignedMember.id })
        .update(restoredAttendanceTimestampWrite);
      const [ordinarySchedule] = (await database('schedules')
        .insert({
          rosterID: roster.id,
          name: 'Shift view overlap fixture',
          description: 'Shift view overlap fixture',
          chorePlanID: null,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      const [ordinaryShift] = (await database('shifts')
        .insert({
          scheduleID: ordinarySchedule.id,
          startTime: new Date(availableShift.startTime),
          endTime: new Date(availableShift.endTime),
          requiredParticipants: 10,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      await database('shift_participants').insert({
        shiftID: ordinaryShift.id,
        userID: unassignedMember.id,
      });
      const overlapRestrictedView = await shiftsController.getForUser(
        roster.id,
        unassignedMember.id,
      );
      const overlapRestrictedShift = overlapRestrictedView.shifts.find(
        ({ id }) => id === availableShift.id,
      );
      assert.equal(
        overlapRestrictedShift?.signupRestrictionReason,
        CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict,
      );
      assert.deepEqual(overlapRestrictedShift?.signupConflictShiftIDs, [
        ordinaryShift.id,
      ]);
      assert.deepEqual(overlapRestrictedShift?.signupConflicts, [
        {
          shiftID: ordinaryShift.id,
          scheduleName: 'Shift view overlap fixture',
          startTime: availableShift.startTime,
          endTime: availableShift.endTime,
        },
      ]);

      await lifecycleController.close(roster.id, member.id);
      const closedView = await shiftsController.getForUser(
        roster.id,
        member.id,
      );
      assert.equal(closedView.plan?.status, 'closed');
      assert.equal(closedView.selfServiceMutationsAllowed, false);
      assert.deepEqual(closedView.shifts, openView.shifts);
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
