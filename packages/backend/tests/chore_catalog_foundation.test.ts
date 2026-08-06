import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';

const FOUNDATION_MIGRATION = '20260806000000_chore_planning_foundation.ts';
const TEST_DATABASE_URL = process.env.CHORE_TEARDOWN_TEST_DATABASE_URL;
const POSTGRES_TEST_OPTIONS = {
  skip: TEST_DATABASE_URL
    ? false
    : 'CHORE_TEARDOWN_TEST_DATABASE_URL is not configured.',
  timeout: 120_000,
};
const STABLE_KEY_SHA256 =
  'f3d351821a204531152f119f9c5fb61615631dde1b30193d4bea9687b58bfddf';
const SOURCE_SHA256 = {
  chore: '78533d7bef2de145afd20be3e3d8376d116405e947558db6b097b13a50a87c99',
  event: 'b4b71cf171823ddd4aac697c0c1d38c51150ee5e8abdb75a1a4d4b5701792de5',
  dinner: '4fb719a8549e81bed82b968b709b7335032e9de288464e62ab83f8eff06e3b42',
} as const;

type CatalogKind = keyof typeof SOURCE_SHA256;

interface CatalogRow {
  stableKey: string;
  kind: CatalogKind;
  shiftLabel: string;
  positionLabel: string;
  dayMode: 'template' | 'explicit';
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: number;
  sourceOrder: number;
  score: string;
}

interface DatabaseError {
  code?: string;
  constraint?: string;
}

interface IDRow {
  id: number;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);

  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The migration test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The migration test requires its dedicated disposable database.',
  );

  return databaseURL;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function csvCell(value: string | number | null): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function sourceCSV(kind: CatalogKind, rows: CatalogRow[]): string {
  let header: string[];
  let values: Array<Array<string | number | null>>;

  if (kind === 'chore') {
    header = ['Time', 'Shift', 'Position', 'Score'];
    values = rows.map((row) => [
      row.timePeriodLabel,
      row.shiftLabel,
      row.positionLabel,
      Number(row.score),
    ]);
  } else if (kind === 'event') {
    header = [
      'Period order label',
      'Day',
      'Time period',
      'Shift',
      'Position',
      'Score',
    ];
    values = rows.map((row) => [
      row.periodOrder,
      row.dayLabel,
      row.timePeriodLabel,
      row.shiftLabel,
      row.positionLabel,
      Number(row.score),
    ]);
  } else {
    header = ['Day', 'Time', 'Shift', 'Position', 'Score'];
    values = rows.map((row) => [
      row.dayLabel,
      row.timePeriodLabel,
      row.shiftLabel,
      row.positionLabel,
      Number(row.score),
    ]);
  }

  return [header, ...values]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function isConstraint(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  const databaseError = error as DatabaseError;
  return databaseError.code === code && databaseError.constraint === constraint;
}

test(
  'foundation installs the exact fixed catalog and enforces domain invariants',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_catalog_foundation_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: {
          extension: 'ts',
          tableName: 'knex_migrations',
        },
        pool: { max: 2, min: 0 },
        searchPath: [schemaName],
      });

      const [, migrationNames] = await database.migrate.latest({
        directory: 'packages/backend/migrations',
        extension: 'ts',
      });
      assert.equal(migrationNames.at(-1), FOUNDATION_MIGRATION);

      const catalog = (await database('chore_catalog_definitions as definition')
        .innerJoin(
          'chore_catalog_scores as score',
          'score.definitionKey',
          'definition.stableKey',
        )
        .select(
          'definition.stableKey',
          'definition.kind',
          'definition.shiftLabel',
          'definition.positionLabel',
          'definition.dayMode',
          'definition.dayNumber',
          'definition.dayLabel',
          'definition.timePeriodLabel',
          'definition.periodOrder',
          'definition.startLocalTime',
          'definition.endLocalTime',
          'definition.endDayOffset',
          'definition.sourceOrder',
          'score.score',
        )) as CatalogRow[];

      assert.equal(catalog.length, 326);
      (
        [
          ['chore', 32],
          ['event', 240],
          ['dinner', 54],
        ] as const
      ).forEach(([kind, expectedCount]) => {
        const rows = catalog
          .filter((row) => row.kind === kind)
          .sort((first, second) => first.sourceOrder - second.sourceOrder);
        assert.equal(rows.length, expectedCount);
        assert.deepEqual(
          rows.map(({ sourceOrder }) => sourceOrder),
          Array.from({ length: expectedCount }, (_value, index) => index),
        );
        assert.equal(sha256(sourceCSV(kind, rows)), SOURCE_SHA256[kind]);
      });

      assert.equal(
        sha256(
          catalog
            .map(({ stableKey }) => stableKey)
            .sort()
            .join('\n'),
        ),
        STABLE_KEY_SHA256,
      );

      assert.deepEqual(
        catalog.find(
          ({ stableKey }) => stableKey === 'chore-am-chum-wench-first',
        ),
        {
          stableKey: 'chore-am-chum-wench-first',
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
        },
      );
      assert.deepEqual(
        catalog.find(({ stableKey }) => stableKey === 'event-02-bar-bouncer'),
        {
          stableKey: 'event-02-bar-bouncer',
          kind: 'event',
          shiftLabel: 'Bar',
          positionLabel: 'Bouncer',
          dayMode: 'explicit',
          dayNumber: 1,
          dayLabel: 'Sunday',
          timePeriodLabel: '9p-12a',
          periodOrder: 2,
          startLocalTime: '21:00:00',
          endLocalTime: '00:00:00',
          endDayOffset: 1,
          sourceOrder: 7,
          score: '90',
        },
      );

      const scoreKey = 'chore-am-chum-wench-first';
      await assert.rejects(
        database('chore_catalog_scores')
          .where({ definitionKey: scoreKey })
          .update({ score: '100.01' }),
        (error) =>
          isConstraint(error, '23514', 'chore_catalog_scores_score_valid'),
      );
      await assert.rejects(
        database('chore_catalog_scores')
          .where({ definitionKey: scoreKey })
          .update({ score: '1.234' }),
        (error) =>
          isConstraint(error, '23514', 'chore_catalog_scores_score_valid'),
      );
      await database('chore_catalog_scores')
        .where({ definitionKey: scoreKey })
        .update({ score: '42.25' });
      assert.equal(
        (
          await database('chore_catalog_scores')
            .where({ definitionKey: scoreKey })
            .first()
        ).score,
        '42.25',
      );

      const { score: _score, ...firstDefinition } = catalog[0];
      await assert.rejects(
        database('chore_catalog_definitions').insert({
          ...firstDefinition,
          stableKey: 'chore-duplicate-semantic-definition',
          sourceOrder: 999,
        }),
        (error) =>
          isConstraint(
            error,
            '23505',
            'chore_catalog_definitions_identity_unique',
          ),
      );

      const {
        score: _eventScore,
        stableKey: _eventStableKey,
        sourceOrder: _eventSourceOrder,
        ...firstEventDefinition
      } = catalog.find(({ kind }) => kind === 'event') as CatalogRow;
      await assert.rejects(
        database('chore_catalog_definitions').insert({
          ...firstEventDefinition,
          stableKey: 'event-invalid-day-definition',
          dayNumber: 2,
          periodOrder: 999,
          sourceOrder: 999,
        }),
        (error) =>
          isConstraint(error, '23514', 'chore_catalog_definitions_day_valid'),
      );

      await assert.rejects(
        database('chore_catalog_state').insert({ id: 2, revision: 1 }),
        (error) =>
          isConstraint(error, '23514', 'chore_catalog_state_singleton'),
      );
      assert.deepEqual(
        await database('chore_catalog_state').select('id', 'revision').first(),
        { id: 1, revision: '1' },
      );

      const [actor] = (await database('users')
        .insert({ email: 'catalog-foundation@example.invalid' })
        .returning('id')) as IDRow[];
      const [draftRoster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [openRoster] = (await database('rosters')
        .insert({ year: 2027 })
        .returning('id')) as IDRow[];
      const [invalidRoster] = (await database('rosters')
        .insert({ year: 2028 })
        .returning('id')) as IDRow[];
      await database('chore_plans').insert({ rosterID: draftRoster.id });

      await assert.rejects(
        database('chore_plans').insert({ rosterID: draftRoster.id }),
        (error) => isConstraint(error, '23505', 'chore_plans_rosterid_unique'),
      );
      await assert.rejects(
        database('chore_plans').insert({
          rosterID: openRoster.id,
          status: 'open',
        }),
        (error) =>
          isConstraint(error, '23514', 'chore_plans_lifecycle_consistent'),
      );
      await assert.rejects(
        database('chore_plans').insert({
          rosterID: invalidRoster.id,
          status: 'invalid',
        }),
        (error) => isConstraint(error, '23514', 'chore_plans_status_valid'),
      );

      const openedAt = new Date('2026-08-05T12:00:00.000Z');
      const [openPlan] = (await database('chore_plans')
        .insert({
          rosterID: openRoster.id,
          status: 'open',
          openedAt,
          openedByUserID: actor.id,
        })
        .returning('id')) as IDRow[];
      await assert.rejects(
        database('chore_plans')
          .where({ id: openPlan.id })
          .update({
            status: 'closed',
            closedAt: new Date('2026-08-05T11:59:59.000Z'),
            closedByUserID: actor.id,
          }),
        (error) =>
          isConstraint(error, '23514', 'chore_plans_lifecycle_consistent'),
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
