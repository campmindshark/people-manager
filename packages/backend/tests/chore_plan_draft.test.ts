import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChoreCatalogController from '../controllers/chore_catalog';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import { seed as seedSchedulesAndShifts } from '../seeds/schedules-and-shifts';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import { ChorePlanApplyRequest } from '../view_models/chore_plan_preview';

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

interface CountRow {
  count: string;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The draft test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The draft test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function applyRequest(
  rosterID: number,
  overrides: Partial<ChorePlanApplyRequest> = {},
): ChorePlanApplyRequest {
  return {
    rosterID,
    camperCount: 1,
    requirements: { chore: 1, event: 1, dinner: 1 },
    expectedCatalogRevision: '1',
    expectedDraftRevision: null,
    ...overrides,
  };
}

function isDraftError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanPreviewError &&
    error.status === status &&
    message.test(error.message)
  );
}

async function countRows(database: Knex, tableName: string): Promise<number> {
  const result = (await database(tableName).count('* as count').first()) as
    CountRow | undefined;
  return Number(result?.count ?? 0);
}

async function persistedPlanState(database: Knex, chorePlanID: number) {
  const generatedShiftIDs = (
    await database('chore_plan_generated_shifts')
      .where({ chorePlanID })
      .orderBy('shiftID')
      .pluck('shiftID')
  ).map(Number);

  return {
    plan: await database('chore_plans').where({ id: chorePlanID }).first(),
    schedules: await database('schedules').where({ chorePlanID }).orderBy('id'),
    shifts: await database('shifts')
      .whereIn('id', generatedShiftIDs)
      .orderBy('id'),
    generatedShifts: await database('chore_plan_generated_shifts')
      .where({ chorePlanID })
      .orderBy('shiftID'),
    slotSnapshots: await database('chore_plan_slot_snapshots')
      .whereIn('shiftID', generatedShiftIDs)
      .orderBy(['shiftID', 'slotOrder']),
    assignments: await database('shift_participants')
      .whereIn('shiftID', generatedShiftIDs)
      .orderBy('id'),
    auditEntries: await database('chore_plan_audit_entries')
      .where({ chorePlanID })
      .orderBy('id'),
  };
}

test(
  'draft apply is transactional, revision-safe, idempotent, and snapshots the catalog',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_draft_${Date.now()}`;
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

      const [actor] = (await database('users')
        .insert({ email: 'draft-admin@example.invalid' })
        .returning('id')) as IDRow[];
      const [participant] = (await database('users')
        .insert({ email: 'draft-participant@example.invalid' })
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [shortageRoster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const controller = new ChorePlanDraftController(database);

      await seedSchedulesAndShifts(database);
      await database.raw(`
        SELECT setval(
          pg_get_serial_sequence('schedules', 'id'),
          1,
          false
        )
      `);
      await database.raw(`
        SELECT setval(
          pg_get_serial_sequence('shifts', 'id'),
          1,
          false
        )
      `);
      await seedSchedulesAndShifts(database);

      await assert.rejects(
        controller.apply(
          applyRequest(shortageRoster.id, {
            camperCount: 200,
            requirements: { chore: 20, event: 20, dinner: 20 },
          }),
          actor.id,
        ),
        (error) => isDraftError(error, 422, /enough positions/i),
      );
      assert.equal(
        Number(
          (
            await database('chore_plans')
              .where({ rosterID: shortageRoster.id })
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        0,
        'an unsatisfiable apply must not create a partial plan',
      );

      const first = await controller.apply(applyRequest(roster.id), actor.id);
      assert.equal(first.changed, true);
      assert.equal(first.replaced, false);
      assert.deepEqual(
        {
          status: first.draft.status,
          draftRevision: first.draft.draftRevision,
          catalogRevision: first.draft.catalogRevision,
          planningYear: first.draft.planningYear,
          camperCount: first.draft.camperCount,
          scheduleCount: first.draft.scheduleCount,
          shiftCount: first.draft.shiftCount,
          slotCount: first.draft.slotCount,
        },
        {
          status: 'draft',
          draftRevision: '1',
          catalogRevision: '1',
          planningYear: 2026,
          camperCount: 1,
          scheduleCount: 3,
          shiftCount: 3,
          slotCount: 3,
        },
      );
      assert.equal(await countRows(database, 'chore_plan_audit_entries'), 1);
      assert.deepEqual(
        await database('chore_plan_audit_entries')
          .select('actorUserID', 'action')
          .first(),
        { actorUserID: actor.id, action: 'draft_applied' },
      );

      const choreSnapshot = await database('chore_plan_slot_snapshots as slot')
        .innerJoin(
          'chore_plan_generated_shifts as generated',
          'generated.shiftID',
          'slot.shiftID',
        )
        .select(
          'slot.definitionKey',
          'slot.kind',
          'slot.shiftLabel',
          'slot.positionLabel',
          'slot.dayMode',
          'slot.dayNumber',
          'slot.dayLabel',
          'slot.timePeriodLabel',
          'slot.periodOrder',
          'slot.startLocalTime',
          'slot.endLocalTime',
          'slot.endDayOffset',
          'slot.sourceOrder',
          'slot.score',
        )
        .where('generated.kind', 'chore')
        .first();
      assert.deepEqual(choreSnapshot, {
        definitionKey: 'chore-am-chum-wench-first',
        kind: 'chore',
        shiftLabel: 'AM Chum Wench',
        positionLabel: 'First',
        dayMode: 'template',
        dayNumber: null,
        dayLabel: null,
        timePeriodLabel: '11:00:00 AM',
        periodOrder: null,
        startLocalTime: '11:00:00',
        endLocalTime: '12:00:00',
        endDayOffset: 0,
        sourceOrder: 0,
        score: '100',
      });

      const firstScheduleIDs = (
        await database('schedules')
          .where({ chorePlanID: first.draft.id })
          .orderBy('id')
          .pluck('id')
      ).map(Number);
      const firstShiftIDs = (
        await database('chore_plan_generated_shifts')
          .where({ chorePlanID: first.draft.id })
          .orderBy('shiftID')
          .pluck('shiftID')
      ).map(Number);
      const repeated = await controller.apply(
        applyRequest(roster.id),
        actor.id,
      );
      assert.equal(repeated.changed, false);
      assert.equal(repeated.replaced, false);
      assert.equal(repeated.draft.draftRevision, '1');
      assert.equal(repeated.draft.updatedAt, first.draft.updatedAt);
      assert.equal(await countRows(database, 'chore_plan_audit_entries'), 1);
      assert.deepEqual(
        (
          await database('schedules')
            .where({ chorePlanID: first.draft.id })
            .orderBy('id')
            .pluck('id')
        ).map(Number),
        firstScheduleIDs,
      );
      assert.deepEqual(
        (
          await database('chore_plan_generated_shifts')
            .where({ chorePlanID: first.draft.id })
            .orderBy('shiftID')
            .pluck('shiftID')
        ).map(Number),
        firstShiftIDs,
      );

      await assert.rejects(
        controller.apply(applyRequest(roster.id, { camperCount: 2 }), actor.id),
        (error) => isDraftError(error, 409, /draft changed/i),
      );
      const replacement = await controller.apply(
        applyRequest(roster.id, {
          camperCount: 2,
          expectedDraftRevision: '1',
        }),
        actor.id,
      );
      assert.equal(replacement.changed, true);
      assert.equal(replacement.replaced, true);
      assert.equal(replacement.draft.draftRevision, '2');
      assert.equal(replacement.draft.slotCount, 6);
      assert.equal(await countRows(database, 'chore_plan_audit_entries'), 2);
      assert.equal(
        Number(
          (
            await database('shifts')
              .whereIn('id', firstShiftIDs)
              .count('* as count')
              .first()
          )?.count ?? 0,
        ),
        3,
        'stable generated shifts should retain their row IDs',
      );

      await new ChoreCatalogController(database).updateScore(
        'chore-am-chum-wench-first',
        { score: 0, expectedRevision: '1' },
        actor.id,
      );
      assert.equal(
        (
          await database('chore_plan_slot_snapshots')
            .where({ definitionKey: 'chore-am-chum-wench-first' })
            .first()
        ).score,
        '100',
        'live score edits must not mutate the persisted draft snapshot',
      );
      await assert.rejects(
        controller.apply(
          applyRequest(roster.id, {
            camperCount: 2,
            expectedDraftRevision: '2',
          }),
          actor.id,
        ),
        (error) => isDraftError(error, 409, /catalog changed/i),
      );
      const refreshed = await controller.apply(
        applyRequest(roster.id, {
          camperCount: 2,
          expectedCatalogRevision: '2',
          expectedDraftRevision: '2',
        }),
        actor.id,
      );
      assert.equal(refreshed.draft.draftRevision, '3');
      assert.equal(refreshed.draft.catalogRevision, '2');
      assert.equal(refreshed.replaced, true);

      const assignedShift = await database('chore_plan_generated_shifts')
        .where({ chorePlanID: first.draft.id })
        .orderBy('shiftID')
        .first();
      await database('shift_participants').insert({
        shiftID: assignedShift.shiftID,
        userID: participant.id,
      });
      const planStateBeforeSeed = await persistedPlanState(
        database,
        first.draft.id,
      );
      await seedSchedulesAndShifts(database);
      const fixtureCountsAfterFirstSeed = {
        schedules: await countRows(database, 'schedules'),
        shifts: await countRows(database, 'shifts'),
      };
      await seedSchedulesAndShifts(database);
      assert.deepEqual(
        await persistedPlanState(database, first.draft.id),
        planStateBeforeSeed,
        'repeat seeding must preserve the plan, generated rows, assignment, snapshots, and audit history',
      );
      assert.deepEqual(
        {
          schedules: await countRows(database, 'schedules'),
          shifts: await countRows(database, 'shifts'),
        },
        fixtureCountsAfterFirstSeed,
        'fixture seeding must be idempotent',
      );
      await assert.rejects(
        controller.apply(
          applyRequest(roster.id, {
            camperCount: 3,
            expectedCatalogRevision: '2',
            expectedDraftRevision: '3',
          }),
          actor.id,
        ),
        (error) => isDraftError(error, 409, /participant assignments/i),
      );
      await database('shift_participants')
        .where({ shiftID: assignedShift.shiftID, userID: participant.id })
        .del();

      const planBeforeFailure = await database('chore_plans')
        .where({ id: first.draft.id })
        .first();
      const shiftsBeforeFailure = await database('chore_plan_generated_shifts')
        .where({ chorePlanID: first.draft.id })
        .orderBy('stableKey');
      const slotsBeforeFailure = await database(
        'chore_plan_slot_snapshots',
      ).orderBy(['shiftID', 'slotOrder']);
      const auditCountBeforeFailure = await countRows(
        database,
        'chore_plan_audit_entries',
      );
      await database.raw(`
        CREATE FUNCTION fail_chore_draft_audit() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced chore draft audit failure';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER fail_chore_draft_audit_trigger
        BEFORE INSERT ON "chore_plan_audit_entries"
        FOR EACH ROW EXECUTE FUNCTION fail_chore_draft_audit();
      `);
      await assert.rejects(
        controller.apply(
          applyRequest(roster.id, {
            camperCount: 3,
            expectedCatalogRevision: '2',
            expectedDraftRevision: '3',
          }),
          actor.id,
        ),
        /forced chore draft audit failure/i,
      );
      assert.deepEqual(
        await database('chore_plans').where({ id: first.draft.id }).first(),
        planBeforeFailure,
      );
      assert.deepEqual(
        await database('chore_plan_generated_shifts')
          .where({ chorePlanID: first.draft.id })
          .orderBy('stableKey'),
        shiftsBeforeFailure,
      );
      assert.deepEqual(
        await database('chore_plan_slot_snapshots').orderBy([
          'shiftID',
          'slotOrder',
        ]),
        slotsBeforeFailure,
      );
      assert.equal(
        await countRows(database, 'chore_plan_audit_entries'),
        auditCountBeforeFailure,
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
