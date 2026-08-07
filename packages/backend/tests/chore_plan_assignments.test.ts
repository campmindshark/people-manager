import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanAssignmentsController from '../controllers/chore_plan_assignments';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import RosterParticipantController from '../controllers/roster_participant';
import RoleConfigCollection from '../roles/role';
import ChorePlanAssignmentError from '../utils/chorePlanAssignmentError';
import {
  parseChorePlanAdminAssignmentMutation,
  parseChorePlanForceAssignmentRequest,
} from '../utils/chorePlanAssignmentInput';

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

interface ShiftRow {
  id: number;
  kind: 'chore' | 'event' | 'dinner';
  startTime: Date | string;
  endTime: Date | string;
  requiredParticipants: number;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The assignment test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The assignment test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isAssignmentError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanAssignmentError &&
    error.status === status &&
    message.test(error.message)
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

test('administrative assignment input is exact and force is separately scoped', () => {
  assert.deepEqual(
    parseChorePlanAdminAssignmentMutation({
      operation: 'move',
      userID: 2,
      fromShiftID: 3,
      toShiftID: 4,
    }),
    { operation: 'move', userID: 2, fromShiftID: 3, toShiftID: 4 },
  );
  assert.deepEqual(
    parseChorePlanForceAssignmentRequest({
      mutation: { operation: 'assign', userID: 2, shiftID: 3 },
      reason: '  Approved exception  ',
    }),
    {
      mutation: { operation: 'assign', userID: 2, shiftID: 3 },
      reason: 'Approved exception',
    },
  );
  assert.throws(
    () =>
      parseChorePlanAdminAssignmentMutation({
        operation: 'assign',
        userID: 2,
        shiftID: 3,
        force: true,
      }),
    (error) => isAssignmentError(error, 400, /unexpected fields/i),
  );
  assert.throws(
    () =>
      parseChorePlanAdminAssignmentMutation({
        operation: 'swap',
        firstUserID: 2,
        firstShiftID: 3,
        secondUserID: 2,
        secondShiftID: 4,
      }),
    (error) => isAssignmentError(error, 400, /two different/i),
  );
  assert.throws(
    () =>
      parseChorePlanForceAssignmentRequest({
        mutation: { operation: 'unassign', userID: 2, shiftID: 3 },
        reason: 'Not needed',
      }),
    (error) => isAssignmentError(error, 400, /never requires/i),
  );

  const admin = RoleConfigCollection.getRoleByName('admin');
  assert(RoleConfigCollection.hasPermission([admin.id], 'chorePlans:assign'));
  assert(
    RoleConfigCollection.hasPermission([admin.id], 'chorePlans:forceAssign'),
  );
  assert(!RoleConfigCollection.hasPermission([], 'chorePlans:assign'));
  assert(!RoleConfigCollection.hasPermission([], 'chorePlans:forceAssign'));
});

test(
  'administrative mutations validate final state and audit forced changes atomically',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_assignments_${Date.now()}`;
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
            email: 'assignment-admin@example.invalid',
          },
          {
            firstName: 'Alpha',
            lastName: 'Camper',
            playaName: 'A',
            email: 'assignment-alpha@example.invalid',
          },
          {
            firstName: 'Beta',
            lastName: 'Camper',
            playaName: 'B',
            email: 'assignment-beta@example.invalid',
          },
          {
            firstName: 'Late',
            lastName: 'Camper',
            email: 'assignment-late@example.invalid',
          },
          {
            firstName: 'Removed',
            lastName: 'Camper',
            email: 'assignment-removed@example.invalid',
          },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      await addParticipant(database, roster.id, users[1].id);
      await addParticipant(database, roster.id, users[1].id);
      await addParticipant(database, roster.id, users[2].id);
      await addParticipant(
        database,
        roster.id,
        users[3].id,
        '2026-09-05T00:00:00.000Z',
        '2026-09-10T00:00:00.000Z',
      );
      await addParticipant(database, roster.id, users[4].id);

      const draftController = new ChorePlanDraftController(database);
      const lifecycleController = new ChorePlanLifecycleController(database);
      const assignmentsController = new ChorePlanAssignmentsController(
        database,
      );
      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 3,
          requirements: { chore: 1, event: 1, dinner: 1 },
          expectedCatalogRevision: '1',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      const shifts = (await database('chore_plan_generated_shifts as generated')
        .innerJoin('shifts as shift', 'shift.id', 'generated.shiftID')
        .select(
          'shift.id',
          'generated.kind',
          'shift.startTime',
          'shift.endTime',
          'shift.requiredParticipants',
        )
        .where('generated.chorePlanID', applied.draft.id)
        .where('generated.kind', 'chore')
        .orderBy('shift.startTime')
        .orderBy('shift.id')) as ShiftRow[];
      const firstShift = shifts[0];
      const secondShift = shifts.find(
        (shift) =>
          shift.id !== firstShift.id &&
          new Date(shift.startTime).getTime() >=
            new Date(firstShift.endTime).getTime(),
      );
      assert(secondShift);

      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        }),
        (error) => isAssignmentError(error, 409, /plan is open/i),
      );
      await lifecycleController.open(roster.id, users[0].id);
      const initialView = await assignmentsController.getView(roster.id);
      assert.equal(initialView.plan?.status, 'open');
      assert.deepEqual(initialView.plan?.requirements, {
        chore: 1,
        event: 1,
        dinner: 1,
      });
      assert.equal(initialView.mutationsAllowed, true);
      assert.deepEqual(
        initialView.participants.map(({ firstName }) => firstName),
        ['Alpha', 'Beta', 'Late', 'Removed'],
      );
      assert(
        initialView.shifts.every(
          (shift) =>
            Number.isInteger(shift.displayDayNumber) &&
            (shift.periodOrder === null || Number.isInteger(shift.periodOrder)),
        ),
      );

      // Align both transactions at the audit insert so conflicting user locks
      // reproduce the cross-actor deadlock deterministically.
      await database.raw(`
        CREATE FUNCTION delay_assignment_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'admin_assignment_mutated' THEN
            PERFORM pg_sleep(0.5);
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER delay_assignment_audit_trigger
        BEFORE INSERT ON chore_plan_audit_entries
        FOR EACH ROW EXECUTE FUNCTION delay_assignment_audit();
      `);
      const crossActorAssignments = await Promise.all([
        assignmentsController.mutate(roster.id, users[1].id, {
          operation: 'assign',
          userID: users[2].id,
          shiftID: firstShift.id,
        }),
        assignmentsController.mutate(roster.id, users[2].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: secondShift.id,
        }),
      ]);
      assert(
        crossActorAssignments.every(
          ({ changed, forced }) => changed && !forced,
        ),
      );
      await database.raw(
        'DROP TRIGGER delay_assignment_audit_trigger ON chore_plan_audit_entries',
      );
      await database.raw('DROP FUNCTION delay_assignment_audit()');
      await assignmentsController.mutate(roster.id, users[0].id, {
        operation: 'unassign',
        userID: users[2].id,
        shiftID: firstShift.id,
      });
      await assignmentsController.mutate(roster.id, users[0].id, {
        operation: 'unassign',
        userID: users[1].id,
        shiftID: secondShift.id,
      });

      assert.deepEqual(
        await assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        }),
        { changed: true, forced: false, bypassedRules: [] },
      );
      assert.deepEqual(
        await assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        }),
        { changed: false, forced: false, bypassedRules: [] },
      );
      assert.deepEqual(
        (await assignmentsController.getView(roster.id)).participants.find(
          ({ userID }) => userID === users[1].id,
        )?.assignedShiftIDs,
        [firstShift.id],
      );
      await assignmentsController.mutate(roster.id, users[0].id, {
        operation: 'assign',
        userID: users[2].id,
        shiftID: secondShift.id,
      });

      const [ordinarySchedule] = (await database('schedules')
        .insert({
          rosterID: roster.id,
          name: 'Administrative overlap fixture',
          description: 'Overlap fixture',
          chorePlanID: null,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      const [ordinaryShift] = (await database('shifts')
        .insert({
          scheduleID: ordinarySchedule.id,
          startTime: secondShift.startTime,
          endTime: secondShift.endTime,
          requiredParticipants: 10,
          plannerKey: null,
        })
        .returning('id')) as IDRow[];
      await database('shift_participants').insert({
        shiftID: ordinaryShift.id,
        userID: users[1].id,
      });
      await database('shift_participants').insert([
        { shiftID: ordinaryShift.id, userID: users[4].id },
        { shiftID: firstShift.id, userID: users[4].id },
      ]);
      // Audit foreign keys take this lock on their actor. Roster cleanup must
      // remain compatible while still serializing assignment changes.
      let releaseActorKeyShare = () => {};
      const actorKeyShareRelease = new Promise<void>((resolve) => {
        releaseActorKeyShare = resolve;
      });
      let confirmActorKeyShare = () => {};
      const actorKeyShareConfirmed = new Promise<void>((resolve) => {
        confirmActorKeyShare = resolve;
      });
      const actorKeyShareTransaction = database.transaction(
        async (transaction) => {
          await transaction('users')
            .select('id')
            .where({ id: users[4].id })
            .forKeyShare()
            .first();
          confirmActorKeyShare();
          await actorKeyShareRelease;
        },
      );
      await actorKeyShareConfirmed;
      try {
        assert.deepEqual(
          await database.transaction(async (transaction) => {
            await transaction.raw("SET LOCAL lock_timeout = '250ms'");
            return RosterParticipantController.RemoveFromRoster(
              roster.id,
              [users[4].id],
              users[0].id,
              transaction,
            );
          }),
          { deletedCount: 1, removedAssignmentCount: 2 },
        );
      } finally {
        releaseActorKeyShare();
        await actorKeyShareTransaction;
      }
      assert.equal(
        await database('roster_participants')
          .where({ rosterID: roster.id, userID: users[4].id })
          .first(),
        undefined,
      );
      assert.equal(
        await database('shift_participants')
          .where({ userID: users[4].id })
          .whereIn('shiftID', [ordinaryShift.id, firstShift.id])
          .first(),
        undefined,
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: ordinaryShift.id, userID: users[1].id })
          .first(),
      );

      const swap = {
        operation: 'swap' as const,
        firstUserID: users[1].id,
        firstShiftID: firstShift.id,
        secondUserID: users[2].id,
        secondShiftID: secondShift.id,
      };
      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, swap),
        (error) => isAssignmentError(error, 409, /overlaps/i),
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: firstShift.id, userID: users[1].id })
          .first(),
      );
      const forcedSwap = await assignmentsController.mutate(
        roster.id,
        users[0].id,
        swap,
        'Approve overlapping handoff',
      );
      assert.equal(forcedSwap.changed, true);
      assert.equal(forcedSwap.forced, true);
      assert(forcedSwap.bypassedRules.some((rule) => /^overlap:/.test(rule)));

      const move = {
        operation: 'move' as const,
        userID: users[2].id,
        fromShiftID: firstShift.id,
        toShiftID: secondShift.id,
      };
      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, move),
        (error) => isAssignmentError(error, 409, /capacity/i),
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: firstShift.id, userID: users[2].id })
          .first(),
      );
      const forcedMove = await assignmentsController.mutate(
        roster.id,
        users[0].id,
        move,
        'Cover the final slot despite capacity',
      );
      assert(
        forcedMove.bypassedRules.includes(`capacity:shift:${secondShift.id}`),
      );

      await assignmentsController.mutate(roster.id, users[0].id, {
        operation: 'unassign',
        userID: users[2].id,
        shiftID: secondShift.id,
      });
      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        }),
        (error) => isAssignmentError(error, 409, /category requirement/i),
      );
      const forcedCategory = await assignmentsController.mutate(
        roster.id,
        users[0].id,
        {
          operation: 'assign',
          userID: users[1].id,
          shiftID: firstShift.id,
        },
        'Approved extra chore',
      );
      assert(
        forcedCategory.bypassedRules.includes(
          `category:user:${users[1].id}:kind:chore`,
        ),
      );

      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'assign',
          userID: users[3].id,
          shiftID: firstShift.id,
        }),
        (error) => isAssignmentError(error, 409, /attendance window/i),
      );
      const forcedAttendance = await assignmentsController.mutate(
        roster.id,
        users[0].id,
        {
          operation: 'assign',
          userID: users[3].id,
          shiftID: firstShift.id,
        },
        'Approved early arrival exception',
      );
      assert(
        forcedAttendance.bypassedRules.includes(
          `attendance:user:${users[3].id}:shift:${firstShift.id}`,
        ),
      );

      const forcedAudit = await database('chore_plan_audit_entries')
        .where({ action: 'admin_assignment_mutated' })
        .whereRaw('("details" ->> \'forced\')::boolean = true')
        .orderBy('id', 'desc')
        .first();
      assert.equal(forcedAudit.actorUserID, users[0].id);
      assert.equal(
        forcedAudit.details.reason,
        'Approved early arrival exception',
      );
      assert.deepEqual(
        forcedAudit.details.bypassedRules,
        forcedAttendance.bypassedRules,
      );
      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'admin_assignment_mutated',
          details: {
            operation: 'assign',
            affectedAssignments: [],
            forced: false,
            reason: null,
            bypassedRules: [],
          },
        }),
        /admin_assignment_details_valid/i,
      );

      await database.raw(`
        CREATE FUNCTION reject_assignment_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW.action = 'admin_assignment_mutated' THEN
            RAISE EXCEPTION 'forced assignment audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_assignment_audit_trigger
        BEFORE INSERT ON chore_plan_audit_entries
        FOR EACH ROW EXECUTE FUNCTION reject_assignment_audit();
      `);
      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'unassign',
          userID: users[3].id,
          shiftID: firstShift.id,
        }),
        /forced assignment audit failure/i,
      );
      assert(
        await database('shift_participants')
          .where({ shiftID: firstShift.id, userID: users[3].id })
          .first(),
      );
      await database.raw(
        'DROP TRIGGER reject_assignment_audit_trigger ON chore_plan_audit_entries',
      );
      await database.raw('DROP FUNCTION reject_assignment_audit()');

      await lifecycleController.close(roster.id, users[0].id);
      await assert.rejects(
        assignmentsController.mutate(roster.id, users[0].id, {
          operation: 'unassign',
          userID: users[3].id,
          shiftID: firstShift.id,
        }),
        (error) => isAssignmentError(error, 409, /plan is open/i),
      );
      assert.equal(
        (await assignmentsController.getView(roster.id)).mutationsAllowed,
        false,
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
