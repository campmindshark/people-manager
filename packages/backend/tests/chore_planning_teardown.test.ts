import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';

const TEARDOWN_MIGRATION = '20260805010000_remove_chore_planning.ts';
const RESET_MIGRATION = '20260805000000_reset_chore_planning_data.ts';
const TEST_DATABASE_URL = process.env.CHORE_TEARDOWN_TEST_DATABASE_URL;
const POSTGRES_TEST_OPTIONS = {
  skip: TEST_DATABASE_URL
    ? false
    : 'CHORE_TEARDOWN_TEST_DATABASE_URL is not configured.',
  timeout: 120_000,
};

interface DatabaseError {
  code?: string;
  constraint?: string;
}

interface IDRow {
  id: number;
}

interface NamedConstraintRow {
  constraintName: string;
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

async function copyMigrations(
  destinationDirectory: string,
  includeTeardown: boolean,
): Promise<void> {
  const sourceDirectory = path.resolve(__dirname, '../migrations');
  await fs.symlink(
    path.resolve(__dirname, '../../../node_modules'),
    path.join(destinationDirectory, 'node_modules'),
    'dir',
  );
  const migrationNames = (await fs.readdir(sourceDirectory))
    .filter((migrationName) => migrationName.endsWith('.ts'))
    .filter(
      (migrationName) =>
        includeTeardown || migrationName !== TEARDOWN_MIGRATION,
    );

  await Promise.all(
    migrationNames.map((migrationName) =>
      fs.copyFile(
        path.join(sourceDirectory, migrationName),
        path.join(destinationDirectory, migrationName),
      ),
    ),
  );
}

async function createSchemaDatabase(
  adminDatabase: Knex,
  databaseURL: string,
  schemaName: string,
): Promise<Knex> {
  await adminDatabase.schema.createSchema(schemaName);

  return knexFactory({
    client: 'postgresql',
    connection: databaseURL,
    migrations: {
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    pool: { max: 2, min: 0 },
    searchPath: [schemaName],
  });
}

async function assertFinalSchema(
  database: Knex,
  schemaName: string,
): Promise<void> {
  await Promise.all(
    [
      'chore_plans',
      'chore_plan_audit_entries',
      'chore_plan_requirement_overrides',
    ].map(async (tableName) => {
      assert.equal(await database.schema.hasTable(tableName), false);
    }),
  );
  assert.equal(
    await database.schema.hasColumn('schedules', 'chorePlanID'),
    false,
  );
  assert.equal(
    await database.schema.hasColumn('schedules', 'plannerKey'),
    false,
  );
  assert.equal(await database.schema.hasColumn('shifts', 'plannerKey'), false);

  const constraints = (await database('information_schema.table_constraints')
    .select('constraint_name as constraintName')
    .where({
      constraint_name: 'shift_participants_shift_user_unique',
      table_name: 'shift_participants',
      table_schema: schemaName,
    })) as NamedConstraintRow[];
  assert.equal(constraints.length, 1);
}

test(
  'teardown removes only chore-owned rows and preserves generic shift integrity',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const migrationsDirectory = await fs.mkdtemp(
      path.join(tmpdir(), 'people-manager-chore-migrations-'),
    );
    const schemaName = `chore_teardown_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await copyMigrations(migrationsDirectory, false);
      database = await createSchemaDatabase(
        adminDatabase,
        databaseURL,
        schemaName,
      );
      const [migrationBatch, migrationNames] = await database.migrate.latest({
        directory: migrationsDirectory,
        extension: 'ts',
      });
      assert(migrationBatch > 0);
      assert.equal(migrationNames.at(-1), RESET_MIGRATION);

      const [ordinaryRoster] = (await database('rosters')
        .insert({ year: 2025 })
        .returning('id')) as IDRow[];
      const [choreRoster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [user] = (await database('users')
        .insert({ email: 'migration-test@example.invalid' })
        .returning('id')) as IDRow[];
      const [chorePlan] = (await database('chore_plans')
        .insert({
          camperCount: 1,
          rosterID: choreRoster.id,
          sheetTitle: 'Disposable migration test plan',
          sheetUrl: 'migration-test://disposable',
        })
        .returning('id')) as IDRow[];
      const [ordinarySchedule] = (await database('schedules')
        .insert({
          description: 'Must remain',
          name: 'Ordinary schedule',
          plannerKey: 'ignored-for-ownership',
          rosterID: ordinaryRoster.id,
        })
        .returning('id')) as IDRow[];
      const [choreSchedule] = (await database('schedules')
        .insert({
          chorePlanID: chorePlan.id,
          description: 'Must be deleted',
          name: 'Chore schedule',
          plannerKey: 'chore-owned',
          rosterID: choreRoster.id,
        })
        .returning('id')) as IDRow[];
      const [ordinaryShift] = (await database('shifts')
        .insert({
          endTime: '2026-08-05T10:00:00.000Z',
          plannerKey: 'ignored-for-ownership',
          requiredParticipants: 2,
          scheduleID: ordinarySchedule.id,
          startTime: '2026-08-05T09:00:00.000Z',
        })
        .returning('id')) as IDRow[];
      const [choreShift] = (await database('shifts')
        .insert({
          endTime: '2026-08-05T12:00:00.000Z',
          plannerKey: 'chore-owned',
          requiredParticipants: 1,
          scheduleID: choreSchedule.id,
          startTime: '2026-08-05T11:00:00.000Z',
        })
        .returning('id')) as IDRow[];
      const [ordinaryParticipant] = (await database('shift_participants')
        .insert({ shiftID: ordinaryShift.id, userID: user.id })
        .returning('id')) as IDRow[];
      const [choreParticipant] = (await database('shift_participants')
        .insert({ shiftID: choreShift.id, userID: user.id })
        .returning('id')) as IDRow[];

      await database('chore_plan_audit_entries').insert({
        action: 'migration-test',
        actorName: 'Migration test',
        chorePlanID: chorePlan.id,
        details: { disposable: true },
      });
      await database('chore_plan_requirement_overrides').insert({
        chorePlanID: chorePlan.id,
        choreRequirement: 1,
        dinnerRequirement: 0,
        eventRequirement: 0,
        reason: 'Migration test fixture',
        userID: user.id,
      });

      const ordinaryScheduleBefore = await database('schedules')
        .select('description', 'id', 'name', 'rosterID')
        .where({ id: ordinarySchedule.id })
        .first();
      const ordinaryShiftBefore = await database('shifts')
        .select(
          'endTime',
          'id',
          'requiredParticipants',
          'scheduleID',
          'startTime',
        )
        .where({ id: ordinaryShift.id })
        .first();
      const ordinaryParticipantBefore = await database('shift_participants')
        .where({ id: ordinaryParticipant.id })
        .first();

      await fs.copyFile(
        path.resolve(__dirname, '../migrations', TEARDOWN_MIGRATION),
        path.join(migrationsDirectory, TEARDOWN_MIGRATION),
      );
      const [, teardownNames] = await database.migrate.latest({
        directory: migrationsDirectory,
        extension: 'ts',
      });
      assert.deepEqual(teardownNames, [TEARDOWN_MIGRATION]);

      await assertFinalSchema(database, schemaName);
      assert.deepEqual(
        await database('schedules')
          .select('description', 'id', 'name', 'rosterID')
          .where({ id: ordinarySchedule.id })
          .first(),
        ordinaryScheduleBefore,
      );
      assert.deepEqual(
        await database('shifts')
          .select(
            'endTime',
            'id',
            'requiredParticipants',
            'scheduleID',
            'startTime',
          )
          .where({ id: ordinaryShift.id })
          .first(),
        ordinaryShiftBefore,
      );
      assert.deepEqual(
        await database('shift_participants')
          .where({ id: ordinaryParticipant.id })
          .first(),
        ordinaryParticipantBefore,
      );
      assert.equal(
        await database('schedules').where({ id: choreSchedule.id }).first(),
        undefined,
      );
      assert.equal(
        await database('shifts').where({ id: choreShift.id }).first(),
        undefined,
      );
      assert.equal(
        await database('shift_participants')
          .where({ id: choreParticipant.id })
          .first(),
        undefined,
      );

      await assert.rejects(
        async () =>
          database?.('shift_participants').insert({
            shiftID: ordinaryShift.id,
            userID: user.id,
          }),
        (error: DatabaseError) =>
          error.code === '23505' &&
          error.constraint === 'shift_participants_shift_user_unique',
      );

      const [, repeatedMigrationNames] = await database.migrate.latest({
        directory: migrationsDirectory,
        extension: 'ts',
      });
      assert.deepEqual(repeatedMigrationNames, []);
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
      await fs.rm(migrationsDirectory, { force: true, recursive: true });
    }
  },
);

test(
  'the full migration history builds the same final schema from scratch',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const migrationsDirectory = await fs.mkdtemp(
      path.join(tmpdir(), 'people-manager-full-migrations-'),
    );
    const schemaName = `chore_teardown_full_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await copyMigrations(migrationsDirectory, true);
      database = await createSchemaDatabase(
        adminDatabase,
        databaseURL,
        schemaName,
      );
      const [, migrationNames] = await database.migrate.latest({
        directory: migrationsDirectory,
        extension: 'ts',
      });
      assert.equal(migrationNames.at(-1), TEARDOWN_MIGRATION);
      await assertFinalSchema(database, schemaName);
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
      await fs.rm(migrationsDirectory, { force: true, recursive: true });
    }
  },
);

test(
  'an unexpected chore schema aborts before destructive changes',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const migrationsDirectory = await fs.mkdtemp(
      path.join(tmpdir(), 'people-manager-guard-migrations-'),
    );
    const schemaName = `chore_teardown_guard_${Date.now()}`;
    let database: Knex | undefined;

    try {
      await copyMigrations(migrationsDirectory, false);
      database = await createSchemaDatabase(
        adminDatabase,
        databaseURL,
        schemaName,
      );
      await database.migrate.latest({
        directory: migrationsDirectory,
        extension: 'ts',
      });

      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [chorePlan] = (await database('chore_plans')
        .insert({
          camperCount: 1,
          rosterID: roster.id,
          sheetTitle: 'Guard test plan',
          sheetUrl: 'migration-test://guard',
        })
        .returning('id')) as IDRow[];
      const [choreSchedule] = (await database('schedules')
        .insert({
          chorePlanID: chorePlan.id,
          name: 'Guard test schedule',
          rosterID: roster.id,
        })
        .returning('id')) as IDRow[];
      await database.schema.alterTable('chore_plans', (table) => {
        table.text('unexpectedColumn');
      });
      await fs.copyFile(
        path.resolve(__dirname, '../migrations', TEARDOWN_MIGRATION),
        path.join(migrationsDirectory, TEARDOWN_MIGRATION),
      );

      await assert.rejects(
        database.migrate.latest({
          directory: migrationsDirectory,
          extension: 'ts',
        }),
        /unexpected chore_plans schema/i,
      );

      assert.equal(await database.schema.hasTable('chore_plans'), true);
      assert.equal(
        await database.schema.hasColumn('schedules', 'chorePlanID'),
        true,
      );
      assert.notEqual(
        await database('schedules').where({ id: choreSchedule.id }).first(),
        undefined,
      );
      assert.equal(
        await database('knex_migrations')
          .where({ name: TEARDOWN_MIGRATION })
          .first(),
        undefined,
      );
    } finally {
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
      await fs.rm(migrationsDirectory, { force: true, recursive: true });
    }
  },
);
