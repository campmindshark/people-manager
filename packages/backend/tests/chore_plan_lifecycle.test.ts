import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import RoleConfigCollection from '../roles/role';
import ChorePlanLifecycleError from '../utils/chorePlanLifecycleError';
import {
  parseChorePlanReopenRequest,
  parseEmptyLifecycleRequest,
} from '../utils/chorePlanLifecycleInput';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import { ChorePlanLifecycleState } from '../view_models/chore_plan_lifecycle';

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

interface ActivityRow {
  waitEventType: string | null;
}

interface ApplicationNameRow {
  applicationName: string;
}

interface ClockRow {
  clockTime: Date | string;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The lifecycle test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The lifecycle test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function isLifecycleError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanLifecycleError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function waitForLockWait(
  database: Knex,
  applicationName: string,
  attempts = 500,
): Promise<void> {
  const activity = (await database('pg_stat_activity')
    .select(database.raw('wait_event_type AS "waitEventType"'))
    .where({ application_name: applicationName })
    .first()) as ActivityRow | undefined;
  if (activity?.waitEventType === 'Lock') {
    return;
  }
  if (attempts === 0) {
    throw new Error('The lifecycle transition did not wait for the plan lock.');
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
  await waitForLockWait(database, applicationName, attempts - 1);
}

test('lifecycle input accepts only narrow transition contracts', () => {
  assert.equal(parseEmptyLifecycleRequest(undefined), undefined);
  assert.equal(parseEmptyLifecycleRequest({}), undefined);
  assert.equal(
    parseChorePlanReopenRequest({ reason: '  Scheduling correction  ' }),
    'Scheduling correction',
  );

  assert.throws(
    () => parseEmptyLifecycleRequest({ reason: 'not accepted' }),
    (error) => isLifecycleError(error, 400, /does not accept/i),
  );
  assert.throws(
    () => parseChorePlanReopenRequest({ reason: '   ' }),
    (error) => isLifecycleError(error, 400, /1 through 500/i),
  );
  assert.throws(
    () => parseChorePlanReopenRequest({ reason: 'x'.repeat(501) }),
    (error) => isLifecycleError(error, 400, /1 through 500/i),
  );
  assert.throws(
    () => parseChorePlanReopenRequest({ reason: 'Valid', force: true }),
    (error) => isLifecycleError(error, 400, /only a reason/i),
  );
});

test('admin role separates ordinary lifecycle and reopening permissions', () => {
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'chorePlans:lifecycle'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'chorePlans:reopen'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([], 'chorePlans:lifecycle'),
    false,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([], 'chorePlans:reopen'),
    false,
  );
});

test(
  'lifecycle transitions lock state, preserve history, and audit atomically',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_lifecycle_${Date.now()}`;
    let database: Knex | undefined;
    let waitingDatabase: Knex | undefined;

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

      const [opener] = (await database('users')
        .insert({ email: 'lifecycle-opener@example.invalid' })
        .returning('id')) as IDRow[];
      const [closer] = (await database('users')
        .insert({ email: 'lifecycle-closer@example.invalid' })
        .returning('id')) as IDRow[];
      const [reopener] = (await database('users')
        .insert({ email: 'lifecycle-reopener@example.invalid' })
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const lifecycleController = new ChorePlanLifecycleController(database);
      const draftController = new ChorePlanDraftController(database);

      assert.deepEqual(await lifecycleController.getByRosterID(roster.id), {
        plan: null,
      });
      await assert.rejects(
        lifecycleController.getByRosterID(roster.id + 1_000_000),
        (error) => isLifecycleError(error, 404, /roster not found/i),
      );
      await assert.rejects(
        lifecycleController.open(roster.id, opener.id),
        (error) => isLifecycleError(error, 404, /not found/i),
      );
      const applied = await draftController.apply(
        {
          rosterID: roster.id,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
          expectedCatalogRevision: '2',
          expectedDraftRevision: null,
        },
        opener.id,
      );
      const loadedDraft = await lifecycleController.getByRosterID(roster.id);
      assert(loadedDraft.plan);
      assert.equal(loadedDraft.plan.status, 'draft');
      assert.equal(loadedDraft.plan.planningYear, 2026);
      assert.equal(loadedDraft.plan.camperCount, 1);
      assert.deepEqual(loadedDraft.plan.requirements, {
        chore: 1,
        event: 1,
        dinner: 1,
      });
      assert.equal(loadedDraft.plan.shiftCount, applied.draft.shiftCount);
      assert.equal(loadedDraft.plan.slotCount, applied.draft.slotCount);

      await assert.rejects(
        lifecycleController.close(roster.id, closer.id),
        (error) => isLifecycleError(error, 409, /open chore plan/i),
      );
      await assert.rejects(
        lifecycleController.reopen(roster.id, reopener.id, 'Not closed'),
        (error) => isLifecycleError(error, 409, /closed chore plan/i),
      );

      const opened = await lifecycleController.open(roster.id, opener.id);
      assert.equal(opened.status, 'open');
      assert.equal(opened.openedByUserID, opener.id);
      assert(opened.openedAt);
      assert.equal(opened.openedAt, opened.updatedAt);
      assert.equal(opened.closedAt, null);
      assert.equal(opened.closedByUserID, null);
      assert.equal(opened.shiftCount, applied.draft.shiftCount);
      assert.equal(opened.slotCount, applied.draft.slotCount);
      await assert.rejects(
        lifecycleController.open(roster.id, opener.id),
        (error) => isLifecycleError(error, 409, /draft chore plan/i),
      );
      await assert.rejects(
        draftController.apply(
          {
            rosterID: roster.id,
            camperCount: 1,
            requirements: { chore: 1, event: 1, dinner: 1 },
            expectedCatalogRevision: '2',
            expectedDraftRevision: '1',
          },
          opener.id,
        ),
        (error) =>
          error instanceof ChorePlanPreviewError &&
          error.status === 409 &&
          /only a draft/i.test(error.message),
      );

      const closeResults = await Promise.allSettled([
        lifecycleController.close(roster.id, closer.id),
        lifecycleController.close(roster.id, closer.id),
      ]);
      const successfulClose = closeResults.find(
        (result) => result.status === 'fulfilled',
      );
      const rejectedClose = closeResults.find(
        (result) => result.status === 'rejected',
      );
      assert(successfulClose);
      assert(rejectedClose);
      assert.equal(successfulClose.status, 'fulfilled');
      assert.equal(rejectedClose.status, 'rejected');
      if (
        successfulClose.status !== 'fulfilled' ||
        rejectedClose.status !== 'rejected'
      ) {
        assert.fail(
          'Concurrent closes did not produce one success and one conflict.',
        );
      }
      assert(isLifecycleError(rejectedClose.reason, 409, /open chore plan/i));
      const closed = successfulClose.value;
      assert.equal(closed.status, 'closed');
      assert.equal(closed.openedAt, opened.openedAt);
      assert.equal(closed.openedByUserID, opener.id);
      assert.equal(closed.closedByUserID, closer.id);
      assert(closed.closedAt);
      assert.equal(closed.closedAt, closed.updatedAt);
      assert(
        new Date(closed.closedAt).getTime() >=
          new Date(opened.openedAt).getTime(),
      );
      await assert.rejects(
        lifecycleController.reopen(roster.id, reopener.id, '   '),
        (error) => isLifecycleError(error, 400, /valid reopening reason/i),
      );

      const reopened = await lifecycleController.reopen(
        roster.id,
        reopener.id,
        '  Corrected participant window  ',
      );
      assert.equal(reopened.status, 'open');
      assert.equal(reopened.openedByUserID, reopener.id);
      assert(reopened.openedAt);
      assert.equal(reopened.openedAt, reopened.updatedAt);
      assert.equal(reopened.closedAt, null);
      assert.equal(reopened.closedByUserID, null);
      assert(
        new Date(reopened.openedAt).getTime() >=
          new Date(closed.closedAt).getTime(),
      );

      const audits = await database('chore_plan_audit_entries')
        .select('actorUserID', 'action', 'details', 'createdAt')
        .where({ chorePlanID: applied.draft.id })
        .orderBy('id');
      assert.deepEqual(
        audits.slice(1).map(({ actorUserID, action, details }) => ({
          actorUserID,
          action,
          details,
        })),
        [
          {
            actorUserID: opener.id,
            action: 'plan_opened',
            details: { fromStatus: 'draft', toStatus: 'open' },
          },
          {
            actorUserID: closer.id,
            action: 'plan_closed',
            details: { fromStatus: 'open', toStatus: 'closed' },
          },
          {
            actorUserID: reopener.id,
            action: 'plan_reopened',
            details: {
              fromStatus: 'closed',
              toStatus: 'open',
              reason: 'Corrected participant window',
            },
          },
        ],
      );
      assert.equal(
        new Date(audits[1].createdAt).toISOString(),
        opened.openedAt,
      );
      assert.equal(
        new Date(audits[2].createdAt).toISOString(),
        closed.closedAt,
      );
      assert.equal(
        new Date(audits[3].createdAt).toISOString(),
        reopened.openedAt,
      );

      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: reopener.id,
          action: 'plan_reopened',
          details: {
            fromStatus: 'closed',
            toStatus: 'open',
            reason: '',
          },
        }),
        (error: { code?: string; constraint?: string }) =>
          error.code === '23514' &&
          error.constraint ===
            'chore_plan_audit_entries_lifecycle_details_valid',
      );

      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: reopener.id,
          action: 'plan_reopened',
          details: {
            fromStatus: 'closed',
            toStatus: 'open',
            reason: ' Padded reason',
          },
        }),
        (error: { code?: string; constraint?: string }) =>
          error.code === '23514' &&
          error.constraint ===
            'chore_plan_audit_entries_lifecycle_details_valid',
      );

      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: reopener.id,
          action: 'plan_reopened',
          details: {
            fromStatus: 'closed',
            toStatus: 'open',
            reason: '\t',
          },
        }),
        (error: { code?: string; constraint?: string }) =>
          error.code === '23514' &&
          error.constraint ===
            'chore_plan_audit_entries_lifecycle_details_valid',
      );

      await assert.rejects(
        database('chore_plan_audit_entries').insert({
          chorePlanID: applied.draft.id,
          actorUserID: reopener.id,
          action: 'plan_reopened',
          details: {
            fromStatus: 'closed',
            toStatus: 'open',
            reason: `${'x'.repeat(500)} `,
          },
        }),
        (error: { code?: string; constraint?: string }) =>
          error.code === '23514' &&
          error.constraint ===
            'chore_plan_audit_entries_lifecycle_details_valid',
      );

      const waitingApplicationName = `chore_lifecycle_wait_${Date.now()}`;
      const waitingDatabaseURL = new URL(databaseURL);
      waitingDatabaseURL.searchParams.set(
        'application_name',
        waitingApplicationName,
      );
      waitingDatabase = knexFactory({
        client: 'postgresql',
        connection: waitingDatabaseURL.toString(),
        pool: { max: 1, min: 0 },
        searchPath: [schemaName],
      });
      const applicationNameResult = (await waitingDatabase.raw(
        'SELECT current_setting(\'application_name\') AS "applicationName"',
      )) as { rows: ApplicationNameRow[] };
      assert.equal(
        applicationNameResult.rows[0].applicationName,
        waitingApplicationName,
      );
      const waitingController = new ChorePlanLifecycleController(
        waitingDatabase,
      );
      let waitingClose: Promise<ChorePlanLifecycleState> | undefined;
      const lockReleasedAt = await database.transaction(async (blocker) => {
        await blocker('chore_plans')
          .where({ id: applied.draft.id })
          .forUpdate()
          .first();
        waitingClose = waitingController.close(roster.id, closer.id);
        await waitForLockWait(blocker, waitingApplicationName);
        const clockResult = (await blocker.raw(
          'SELECT clock_timestamp() AS "clockTime"',
        )) as { rows: ClockRow[] };
        return new Date(clockResult.rows[0].clockTime);
      });
      assert(waitingClose);
      const closedAfterWait = await waitingClose;
      assert(closedAfterWait.closedAt);
      assert(
        new Date(closedAfterWait.closedAt).getTime() >=
          lockReleasedAt.getTime(),
        'A lifecycle transition must be timestamped after acquiring its row lock.',
      );
      await lifecycleController.reopen(
        roster.id,
        reopener.id,
        'Restore open state after timestamp test',
      );

      const planBeforeAuditFailure = await database('chore_plans')
        .where({ id: applied.draft.id })
        .first();
      await database.raw(`
        CREATE FUNCTION fail_chore_lifecycle_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW."action" = 'plan_closed' THEN
            RAISE EXCEPTION 'forced chore lifecycle audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER fail_chore_lifecycle_audit_trigger
        BEFORE INSERT ON "chore_plan_audit_entries"
        FOR EACH ROW EXECUTE FUNCTION fail_chore_lifecycle_audit();
      `);
      await assert.rejects(
        lifecycleController.close(roster.id, closer.id),
        /forced chore lifecycle audit failure/i,
      );
      assert.deepEqual(
        await database('chore_plans').where({ id: applied.draft.id }).first(),
        planBeforeAuditFailure,
      );
      assert.equal(
        Number(
          (
            await database('chore_plan_audit_entries')
              .where({ chorePlanID: applied.draft.id })
              .count('* as count')
              .first()
          )?.count,
        ),
        audits.length + 2,
      );
    } finally {
      await waitingDatabase?.destroy();
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
