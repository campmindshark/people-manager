import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChoreCatalogController from '../controllers/chore_catalog';
import RoleConfigCollection from '../roles/role';
import ChoreCatalogError from '../utils/choreCatalogError';
import {
  isValidChoreCatalogScore,
  parseChoreCatalogScoreUpdate,
} from '../utils/choreCatalogInput';

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
    'The migration test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The migration test requires its dedicated disposable database.',
  );

  return databaseURL;
}

function isCatalogError(
  error: unknown,
  status: number,
  messagePattern: RegExp,
): boolean {
  return (
    error instanceof ChoreCatalogError &&
    error.status === status &&
    messagePattern.test(error.message)
  );
}

test('catalog update input accepts only the score contract', () => {
  assert.deepEqual(
    parseChoreCatalogScoreUpdate({ score: 42.25, expectedRevision: '7' }),
    { score: 42.25, expectedRevision: '7' },
  );
  assert.equal(isValidChoreCatalogScore(0), true);
  assert.equal(isValidChoreCatalogScore(100), true);
  assert.equal(isValidChoreCatalogScore(1.23), true);
  assert.equal(isValidChoreCatalogScore(1.234), false);
  assert.equal(isValidChoreCatalogScore(-1), false);
  assert.equal(isValidChoreCatalogScore(100.01), false);
  assert.equal(isValidChoreCatalogScore('42'), false);

  assert.throws(
    () =>
      parseChoreCatalogScoreUpdate({
        score: 42,
        expectedRevision: '7',
        shiftLabel: 'Changed',
      }),
    (error) => isCatalogError(error, 400, /only score/i),
  );
  assert.throws(
    () => parseChoreCatalogScoreUpdate({ score: 1.234, expectedRevision: '7' }),
    (error) => isCatalogError(error, 400, /two decimal/i),
  );
  assert.throws(
    () => parseChoreCatalogScoreUpdate({ score: 42, expectedRevision: 7 }),
    (error) => isCatalogError(error, 400, /revision/i),
  );
});

test('admin role has separate catalog read and score-edit permissions', () => {
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'choreCatalog:read'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'choreCatalog:editScores'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([], 'choreCatalog:editScores'),
    false,
  );
});

test(
  'catalog updates serialize revisions and audit changed scores atomically',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_catalog_management_${Date.now()}`;
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
        pool: { max: 4, min: 0 },
        searchPath: [schemaName],
      });
      await database.migrate.latest({
        directory: path.resolve(__dirname, '../migrations'),
        extension: 'ts',
      });

      const [firstActor] = (await database('users')
        .insert({ email: 'first-score-admin@example.invalid' })
        .returning('id')) as IDRow[];
      const [secondActor] = (await database('users')
        .insert({ email: 'second-score-admin@example.invalid' })
        .returning('id')) as IDRow[];
      const controller = new ChoreCatalogController(database);

      const initial = await controller.getCatalog();
      assert.equal(initial.revision, '1');
      assert.equal(initial.definitions.length, 302);
      assert.deepEqual(
        initial.definitions.slice(0, 3).map(({ stableKey }) => stableKey),
        [
          'chore-am-chum-wench-first',
          'chore-pm-chum-wench-first',
          'chore-am-ice-bitch-first',
        ],
      );
      assert.equal(initial.definitions[31].kind, 'chore');
      assert.equal(initial.definitions[32].kind, 'event');
      assert.equal(initial.definitions[248].kind, 'dinner');

      const firstKey = initial.definitions[0].stableKey;
      const changed = await controller.updateScore(
        firstKey,
        { score: 42.25, expectedRevision: '1' },
        firstActor.id,
      );
      assert.equal(changed.revision, '2');
      assert.equal(changed.definition.score, 42.25);
      assert.deepEqual(
        await database('chore_catalog_score_audit_entries')
          .select(
            'actorUserID',
            'definitionKey',
            'oldScore',
            'newScore',
            'previousRevision',
            'newRevision',
          )
          .first(),
        {
          actorUserID: firstActor.id,
          definitionKey: firstKey,
          oldScore: '100',
          newScore: '42.25',
          previousRevision: '1',
          newRevision: '2',
        },
      );

      const unchanged = await controller.updateScore(
        firstKey,
        { score: 42.25, expectedRevision: '2' },
        secondActor.id,
      );
      assert.equal(unchanged.revision, '2');
      assert.equal(
        Number(
          (
            await database('chore_catalog_score_audit_entries')
              .count('* as count')
              .first()
          )?.count,
        ),
        1,
      );

      await assert.rejects(
        controller.updateScore(
          initial.definitions[1].stableKey,
          { score: 41, expectedRevision: '1' },
          secondActor.id,
        ),
        (error) => isCatalogError(error, 409, /changed/i),
      );
      await assert.rejects(
        controller.updateScore(
          'chore-definition-that-does-not-exist',
          { score: 41, expectedRevision: '2' },
          secondActor.id,
        ),
        (error) => isCatalogError(error, 404, /not found/i),
      );

      const concurrentKeys = [
        initial.definitions[1].stableKey,
        initial.definitions[2].stableKey,
      ];
      const concurrentResults = await Promise.allSettled([
        controller.updateScore(
          concurrentKeys[0],
          { score: 40, expectedRevision: '2' },
          firstActor.id,
        ),
        controller.updateScore(
          concurrentKeys[1],
          { score: 30, expectedRevision: '2' },
          secondActor.id,
        ),
      ]);
      assert.equal(
        concurrentResults.filter(({ status }) => status === 'fulfilled').length,
        1,
      );
      assert.equal(
        concurrentResults.filter(
          (result) =>
            result.status === 'rejected' &&
            isCatalogError(result.reason, 409, /changed/i),
        ).length,
        1,
      );
      assert.deepEqual(
        await database('chore_catalog_state').select('revision').first(),
        { revision: '3' },
      );
      assert.equal(
        Number(
          (
            await database('chore_catalog_score_audit_entries')
              .count('* as count')
              .first()
          )?.count,
        ),
        2,
      );

      await database.raw(`
        CREATE FUNCTION "reject_score_audit"() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'audit unavailable';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER "reject_score_audit_insert"
        BEFORE INSERT ON "chore_catalog_score_audit_entries"
        FOR EACH ROW EXECUTE FUNCTION "reject_score_audit"();
      `);

      const rollbackKey = initial.definitions[3].stableKey;
      const rollbackScore = initial.definitions[3].score;
      await assert.rejects(
        controller.updateScore(
          rollbackKey,
          { score: 39, expectedRevision: '3' },
          firstActor.id,
        ),
        /audit unavailable/i,
      );
      assert.deepEqual(
        await database('chore_catalog_state').select('revision').first(),
        { revision: '3' },
      );
      assert.equal(
        Number(
          (
            await database('chore_catalog_scores')
              .select('score')
              .where({ definitionKey: rollbackKey })
              .first()
          )?.score,
        ),
        rollbackScore,
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
