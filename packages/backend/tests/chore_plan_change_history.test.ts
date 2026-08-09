import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanChangeHistoryController from '../controllers/chore_plan_change_history';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import RoleConfigCollection from '../roles/role';
import ChorePlanChangeHistoryError from '../utils/chorePlanChangeHistoryError';

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
  shiftID: number;
  chorePlanID: number;
  stableKey: string;
  kind: 'chore' | 'event' | 'dinner';
  scheduleName: string;
  displayDayLabel: string;
  timePeriodLabel: string;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The change-history test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The change-history test requires its dedicated disposable database.',
  );
  return databaseURL;
}

test('the administrator role has the separate change-history permission', () => {
  const admin = RoleConfigCollection.getRoleByName('admin');
  assert(
    RoleConfigCollection.hasPermission([admin.id], 'chorePlans:viewHistory'),
  );
  assert(!RoleConfigCollection.hasPermission([], 'chorePlans:viewHistory'));
});

test(
  'change history is roster-scoped, newest-first, enriched, and read-only',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_change_history_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: { extension: 'ts', tableName: 'knex_migrations' },
        pool: { max: 4, min: 0 },
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
            playaName: 'Operator',
            email: 'history-admin@example.invalid',
          },
          {
            firstName: 'Sam',
            lastName: 'Camper',
            playaName: 'Sparkles',
            email: 'history-participant@example.invalid',
          },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [emptyRoster] = (await database('rosters')
        .insert({ year: 2027 })
        .returning('id')) as IDRow[];
      const applied = await new ChorePlanDraftController(database).apply(
        {
          rosterID: roster.id,
          camperCount: 2,
          requirements: { chore: 3, event: 3, dinner: 1 },
          expectedCatalogRevision: '2',
          expectedDraftRevision: null,
        },
        users[0].id,
      );
      const shift = (await database<GeneratedShiftRow>(
        'chore_plan_generated_shifts',
      )
        .select(
          'shiftID',
          'stableKey',
          'kind',
          'scheduleName',
          'displayDayLabel',
          'timePeriodLabel',
        )
        .where({ chorePlanID: applied.draft.id })
        .orderBy('shiftID')
        .first()) as GeneratedShiftRow;

      await database('chore_plan_audit_entries').insert([
        {
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'participant_requirements_overridden',
          details: {
            participantUserID: users[1].id,
            previousRequirements: { chore: 3, event: 3, dinner: 1 },
            requirements: { chore: 1, event: 2, dinner: 1 },
            previousReason: null,
            reason: 'Late arrival',
            removedAssignments: [
              {
                shiftID: shift.shiftID,
                stableKey: shift.stableKey,
                kind: shift.kind,
              },
            ],
          },
          createdAt: new Date('2099-08-08T14:00:00.000Z'),
        },
        {
          chorePlanID: applied.draft.id,
          actorUserID: users[0].id,
          action: 'admin_assignment_mutated',
          details: {
            operation: 'assign',
            affectedAssignments: [
              {
                action: 'added',
                userID: users[1].id,
                shiftID: shift.shiftID,
              },
            ],
            forced: true,
            reason: 'Approved attendance exception',
            bypassedRules: [
              `attendance:user:${users[1].id}:shift:${shift.shiftID}`,
            ],
          },
          createdAt: new Date('2099-08-08T15:00:00.000Z'),
        },
      ]);

      const controller = new ChorePlanChangeHistoryController(database);
      const auditCountBefore = Number(
        (
          await database('chore_plan_audit_entries')
            .where({ chorePlanID: applied.draft.id })
            .count('* as count')
            .first()
        )?.count ?? 0,
      );
      const history = await controller.getByRosterID(roster.id);
      const auditCountAfter = Number(
        (
          await database('chore_plan_audit_entries')
            .where({ chorePlanID: applied.draft.id })
            .count('* as count')
            .first()
        )?.count ?? 0,
      );

      assert.equal(history.rosterID, roster.id);
      assert.equal(history.hasMore, false);
      assert.equal(history.entries[0].action, 'admin_assignment_mutated');
      assert.equal(history.entries[0].actor.id, users[0].id);
      assert.equal(history.entries[0].actor.name, 'Operator (Admin Actor)');
      assert.equal(history.entries[0].createdAt, '2099-08-08T15:00:00.000Z');
      if (history.entries[0].action !== 'admin_assignment_mutated') {
        assert.fail('Expected an administrative assignment audit entry.');
      }
      assert.equal(history.entries[0].details.forced, true);
      assert.equal(
        history.entries[0].details.reason,
        'Approved attendance exception',
      );
      assert.deepEqual(history.entries[0].details.bypassedRules, [
        `attendance:user:${users[1].id}:shift:${shift.shiftID}`,
      ]);
      assert.deepEqual(history.entries[0].details.affectedAssignments[0], {
        action: 'added',
        participant: {
          id: users[1].id,
          name: 'Sparkles (Sam Camper)',
        },
        shift: {
          id: shift.shiftID,
          stableKey: shift.stableKey,
          kind: shift.kind,
          scheduleName: shift.scheduleName,
          displayDayLabel: shift.displayDayLabel,
          timePeriodLabel: shift.timePeriodLabel,
        },
      });
      assert.equal(
        history.entries[1].action,
        'participant_requirements_overridden',
      );
      if (history.entries[1].action !== 'participant_requirements_overridden') {
        assert.fail('Expected a participant requirement audit entry.');
      }
      assert.equal(
        history.entries[1].details.participant.name,
        'Sparkles (Sam Camper)',
      );
      assert.equal(history.entries[1].details.reason, 'Late arrival');
      assert.equal(
        history.entries[1].details.removedAssignments[0].shift.scheduleName,
        shift.scheduleName,
      );
      assert.equal(auditCountAfter, auditCountBefore);
      assert.deepEqual(await controller.getByRosterID(emptyRoster.id), {
        rosterID: emptyRoster.id,
        entries: [],
        hasMore: false,
      });
      await assert.rejects(
        controller.getByRosterID(emptyRoster.id + 1000),
        (error) =>
          error instanceof ChorePlanChangeHistoryError &&
          error.status === 404 &&
          /roster not found/i.test(error.message),
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
