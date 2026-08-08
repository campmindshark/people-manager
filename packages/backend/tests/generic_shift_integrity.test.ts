import assert from 'node:assert/strict';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import GroupController from '../controllers/group';
import ShiftController from '../controllers/shift';
import ShiftSignupError, { parseShiftID } from '../utils/shiftSignupError';
import { shiftTimeRangesOverlap } from '../utils/shiftTime';
import {
  down as restoreLegacyEventTimestamps,
  up as normalizeEventTimestamps,
} from '../migrations/20260805020000_normalize_event_timestamps';
import {
  down as restoreLegacyRosterAttendanceTimestamps,
  up as normalizeRosterAttendanceTimestamps,
} from '../migrations/20260805030000_normalize_roster_attendance_timestamps';

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
    'The integration test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The integration test requires its dedicated disposable database.',
  );

  return databaseURL;
}

async function createTestDatabase(
  databaseURL: string,
  timestampsUseTimezone = true,
): Promise<{ adminDatabase: Knex; database: Knex; schemaName: string }> {
  const adminDatabase = knexFactory({
    client: 'postgresql',
    connection: databaseURL,
    pool: { max: 5, min: 0 },
  });
  const schemaName = `generic_shift_${Date.now()}_${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  await adminDatabase.schema.createSchema(schemaName);
  const database = knexFactory({
    client: 'postgresql',
    connection: databaseURL,
    pool: { max: 5, min: 0 },
    searchPath: [schemaName],
  });

  await database.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
  });
  await database.schema.createTable('rosters', (table) => {
    table.increments('id').primary();
    table.integer('year').notNullable();
  });
  await database.schema.createTable('schedules', (table) => {
    table.increments('id').primary();
    table.integer('rosterID').notNullable();
  });
  await database.schema.createTable('roster_participants', (table) => {
    table.increments('id').primary();
    table.integer('rosterID').notNullable();
    table.integer('userID').notNullable();
    table.timestamp('estimatedArrivalDate', { useTz: true }).notNullable();
    table.timestamp('estimatedDepartureDate', { useTz: true }).notNullable();
    table.unique(['rosterID', 'userID']);
  });
  await database.schema.createTable('shifts', (table) => {
    table.increments('id').primary();
    table.integer('scheduleID').notNullable();
    table
      .timestamp('startTime', { useTz: timestampsUseTimezone })
      .notNullable();
    table.timestamp('endTime', { useTz: timestampsUseTimezone }).notNullable();
    table.integer('requiredParticipants').notNullable();
  });
  await database.schema.createTable('groups', (table) => {
    table.increments('id').primary();
    table.integer('rosterID').notNullable();
    table
      .timestamp('shiftSignupOpenDate', { useTz: timestampsUseTimezone })
      .notNullable();
  });
  await database.schema.createTable('group_members', (table) => {
    table.integer('groupID').notNullable();
    table.integer('userID').notNullable();
  });
  await database.schema.createTable('shift_participants', (table) => {
    table.increments('id').primary();
    table.integer('shiftID').notNullable();
    table.integer('userID').notNullable();
    table.unique(['shiftID', 'userID']);
  });

  return { adminDatabase, database, schemaName };
}

async function destroyTestDatabase(
  adminDatabase: Knex,
  database: Knex,
  schemaName: string,
): Promise<void> {
  await database.destroy();
  await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
  await adminDatabase.destroy();
}

test(
  'priority signup access is roster-scoped and uses database UTC time',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const { adminDatabase, database, schemaName } =
      await createTestDatabase(databaseURL);

    try {
      const [user] = (await database('users')
        .insert({ name: 'Priority test user' })
        .returning('id')) as IDRow[];
      const [firstRoster, secondRoster] = (await database('rosters')
        .insert([{ year: 2025 }, { year: 2026 }])
        .returning('id')) as IDRow[];
      const [otherRosterOpenGroup, futureGroup, openGroup] = (await database(
        'groups',
      )
        .insert([
          {
            rosterID: firstRoster.id,
            shiftSignupOpenDate: database.raw(
              "CURRENT_TIMESTAMP - interval '1 minute'",
            ),
          },
          {
            rosterID: secondRoster.id,
            shiftSignupOpenDate: database.raw(
              "CURRENT_TIMESTAMP + interval '1 hour'",
            ),
          },
          {
            rosterID: secondRoster.id,
            shiftSignupOpenDate: database.raw(
              "CURRENT_TIMESTAMP - interval '1 minute'",
            ),
          },
        ])
        .returning('id')) as IDRow[];

      await database('group_members').insert({
        groupID: otherRosterOpenGroup.id,
        userID: user.id,
      });
      assert.deepEqual(
        await GroupController.GetShiftSignupAccessForUser(
          user.id,
          secondRoster.id,
          database,
        ),
        { hasGroup: false, signupOpen: false },
      );

      await database('group_members').insert({
        groupID: futureGroup.id,
        userID: user.id,
      });
      assert.deepEqual(
        await GroupController.GetShiftSignupAccessForUser(
          user.id,
          secondRoster.id,
          database,
        ),
        { hasGroup: true, signupOpen: false },
      );

      await database('group_members').insert({
        groupID: openGroup.id,
        userID: user.id,
      });
      assert.deepEqual(
        await GroupController.GetShiftSignupAccessForUser(
          user.id,
          secondRoster.id,
          database,
        ),
        { hasGroup: true, signupOpen: true },
      );
    } finally {
      await destroyTestDatabase(adminDatabase, database, schemaName);
    }
  },
);

test(
  'timestamp migration preserves legacy UTC wall clocks as absolute instants',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const { adminDatabase, database, schemaName } = await createTestDatabase(
      databaseURL,
      false,
    );

    try {
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [schedule] = (await database('schedules')
        .insert({ rosterID: roster.id })
        .returning('id')) as IDRow[];
      await database('shifts').insert({
        scheduleID: schedule.id,
        startTime: database.raw("'2026-08-24 16:00:00'::timestamp"),
        endTime: database.raw("'2026-08-24 17:00:00'::timestamp"),
        requiredParticipants: 1,
      });
      await database('groups').insert({
        rosterID: roster.id,
        shiftSignupOpenDate: database.raw("'2026-01-15 17:00:00'::timestamp"),
      });

      await normalizeEventTimestamps(database);
      const { shift, group } = await database.transaction(
        async (transaction) => {
          await transaction.raw("SET LOCAL TIME ZONE 'America/New_York'");
          return {
            shift: await transaction('shifts')
              .select('startTime', 'endTime')
              .first(),
            group: await transaction('groups')
              .select('shiftSignupOpenDate')
              .first(),
          };
        },
      );
      assert.equal(
        new Date(shift.startTime).toISOString(),
        '2026-08-24T16:00:00.000Z',
      );
      assert.equal(
        new Date(shift.endTime).toISOString(),
        '2026-08-24T17:00:00.000Z',
      );
      assert.equal(
        new Date(group.shiftSignupOpenDate).toISOString(),
        '2026-01-15T17:00:00.000Z',
      );

      await restoreLegacyEventTimestamps(database);
      const restoredShift = await database('shifts')
        .select(
          database.raw(
            `to_char("startTime", 'YYYY-MM-DD HH24:MI:SS') AS "startTime"`,
          ),
          database.raw(
            `to_char("endTime", 'YYYY-MM-DD HH24:MI:SS') AS "endTime"`,
          ),
        )
        .first();
      assert.deepEqual(restoredShift, {
        startTime: '2026-08-24 16:00:00',
        endTime: '2026-08-24 17:00:00',
      });
    } finally {
      await destroyTestDatabase(adminDatabase, database, schemaName);
    }
  },
);

test(
  'attendance migration restores instants shifted by the legacy roster route',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const { adminDatabase, database, schemaName } =
      await createTestDatabase(databaseURL);

    try {
      const [historicalUser, activeUser] = (await database('users')
        .insert([
          { name: 'Historical attendance migration user' },
          { name: 'Active attendance migration user' },
        ])
        .returning('id')) as IDRow[];
      const [historicalRoster, activeRoster] = (await database('rosters')
        .insert([{ year: 2025 }, { year: 2026 }])
        .returning('id')) as IDRow[];
      await database('roster_participants').insert([
        {
          rosterID: historicalRoster.id,
          userID: historicalUser.id,
          estimatedArrivalDate: '2025-08-24T23:00:00.000Z',
          estimatedDepartureDate: '2025-08-25T01:00:00.000Z',
        },
        {
          rosterID: activeRoster.id,
          userID: activeUser.id,
          estimatedArrivalDate: '2026-08-24T23:00:00.000Z',
          estimatedDepartureDate: '2026-08-25T01:00:00.000Z',
        },
      ]);

      await normalizeRosterAttendanceTimestamps(database);
      const normalized = await database('roster_participants')
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where('rosterID', activeRoster.id)
        .first();
      assert.equal(
        new Date(normalized.estimatedArrivalDate).toISOString(),
        '2026-08-24T16:00:00.000Z',
      );
      assert.equal(
        new Date(normalized.estimatedDepartureDate).toISOString(),
        '2026-08-24T18:00:00.000Z',
      );
      const historical = await database('roster_participants')
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where('rosterID', historicalRoster.id)
        .first();
      assert.equal(
        new Date(historical.estimatedArrivalDate).toISOString(),
        '2025-08-24T23:00:00.000Z',
      );
      assert.equal(
        new Date(historical.estimatedDepartureDate).toISOString(),
        '2025-08-25T01:00:00.000Z',
      );

      await restoreLegacyRosterAttendanceTimestamps(database);
      const restored = await database('roster_participants')
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where('rosterID', activeRoster.id)
        .first();
      assert.equal(
        new Date(restored.estimatedArrivalDate).toISOString(),
        '2026-08-24T23:00:00.000Z',
      );
      assert.equal(
        new Date(restored.estimatedDepartureDate).toISOString(),
        '2026-08-25T01:00:00.000Z',
      );
    } finally {
      await destroyTestDatabase(adminDatabase, database, schemaName);
    }
  },
);

test(
  'ordinary signup serializes capacity and prevents duplicates and overlaps',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const { adminDatabase, database, schemaName } =
      await createTestDatabase(databaseURL);

    try {
      const users = (await database('users')
        .insert([
          { name: 'Capacity user one' },
          { name: 'Capacity user two' },
          { name: 'Future group user' },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [schedule] = (await database('schedules')
        .insert({ rosterID: roster.id })
        .returning('id')) as IDRow[];
      const [openGroup, futureGroup] = (await database('groups')
        .insert([
          {
            rosterID: roster.id,
            shiftSignupOpenDate: database.raw(
              "CURRENT_TIMESTAMP - interval '1 minute'",
            ),
          },
          {
            rosterID: roster.id,
            shiftSignupOpenDate: database.raw(
              "CURRENT_TIMESTAMP + interval '1 hour'",
            ),
          },
        ])
        .returning('id')) as IDRow[];
      await database('group_members').insert([
        { groupID: openGroup.id, userID: users[0].id },
        { groupID: openGroup.id, userID: users[1].id },
        { groupID: futureGroup.id, userID: users[2].id },
      ]);
      await database('roster_participants').insert(
        users.map(({ id: userID }) => ({
          rosterID: roster.id,
          userID,
          estimatedArrivalDate: '2026-08-20T00:00:00.000Z',
          estimatedDepartureDate: '2026-09-10T00:00:00.000Z',
        })),
      );

      const shifts = (await database('shifts')
        .insert([
          {
            scheduleID: schedule.id,
            startTime: '2026-08-24T09:00:00.000Z',
            endTime: '2026-08-24T10:00:00.000Z',
            requiredParticipants: 1,
          },
          {
            scheduleID: schedule.id,
            startTime: '2026-08-24T09:30:00.000Z',
            endTime: '2026-08-24T10:30:00.000Z',
            requiredParticipants: 2,
          },
          {
            scheduleID: schedule.id,
            startTime: '2026-08-24T10:00:00.000Z',
            endTime: '2026-08-24T11:00:00.000Z',
            requiredParticipants: 2,
          },
        ])
        .returning('id')) as IDRow[];

      const raceResults = await Promise.allSettled([
        ShiftController.RegisterParticipantForShift(
          shifts[0].id,
          users[0].id,
          database,
        ),
        ShiftController.RegisterParticipantForShift(
          shifts[0].id,
          users[1].id,
          database,
        ),
      ]);
      assert.equal(
        raceResults.filter(({ status }) => status === 'fulfilled').length,
        1,
      );
      const rejectedRace = raceResults.find(
        ({ status }) => status === 'rejected',
      ) as PromiseRejectedResult;
      assert.ok(rejectedRace.reason instanceof ShiftSignupError);
      assert.equal(rejectedRace.reason.status, 409);
      assert.equal(
        await database('shift_participants')
          .where('shiftID', shifts[0].id)
          .count('* as count')
          .first()
          .then((row) => Number(row?.count ?? 0)),
        1,
      );

      const winningAssignment = await database('shift_participants')
        .where('shiftID', shifts[0].id)
        .first();
      const winningUserID = Number(winningAssignment.userID);
      assert.deepEqual(
        await ShiftController.RegisterParticipantForShift(
          shifts[0].id,
          winningUserID,
          database,
        ),
        { registeredShiftIDs: [] },
      );

      await assert.rejects(
        ShiftController.RegisterParticipantForShift(
          shifts[1].id,
          winningUserID,
          database,
        ),
        (error: unknown) =>
          error instanceof ShiftSignupError && error.status === 409,
      );
      assert.deepEqual(
        await ShiftController.RegisterParticipantForShift(
          shifts[2].id,
          winningUserID,
          database,
        ),
        { registeredShiftIDs: [shifts[2].id] },
      );
      await assert.rejects(
        ShiftController.RegisterParticipantForShift(
          shifts[2].id,
          users[2].id,
          database,
        ),
        (error: unknown) =>
          error instanceof ShiftSignupError && error.status === 403,
      );
    } finally {
      await destroyTestDatabase(adminDatabase, database, schemaName);
    }
  },
);

test(
  'ordinary signup requires roster attendance and compares absolute instants',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const { adminDatabase, database, schemaName } =
      await createTestDatabase(databaseURL);

    try {
      const users = (await database('users')
        .insert([
          { name: 'Absent roster participant' },
          { name: 'Arrives after shift starts' },
          { name: 'Departs before shift ends' },
          { name: 'Offset attendance participant' },
        ])
        .returning('id')) as IDRow[];
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const [schedule] = (await database('schedules')
        .insert({ rosterID: roster.id })
        .returning('id')) as IDRow[];
      const [openGroup] = (await database('groups')
        .insert({
          rosterID: roster.id,
          shiftSignupOpenDate: database.raw(
            "CURRENT_TIMESTAMP - interval '1 minute'",
          ),
        })
        .returning('id')) as IDRow[];
      await database('group_members').insert(
        users.map(({ id: userID }) => ({ groupID: openGroup.id, userID })),
      );
      await database('roster_participants').insert([
        {
          rosterID: roster.id,
          userID: users[1].id,
          estimatedArrivalDate: '2026-08-24T16:30:00.000Z',
          estimatedDepartureDate: '2026-08-24T18:00:00.000Z',
        },
        {
          rosterID: roster.id,
          userID: users[2].id,
          estimatedArrivalDate: '2026-08-24T15:00:00.000Z',
          estimatedDepartureDate: '2026-08-24T16:30:00.000Z',
        },
        {
          rosterID: roster.id,
          userID: users[3].id,
          estimatedArrivalDate: '2026-08-24T11:30:00.000-04:00',
          estimatedDepartureDate: '2026-08-24T20:00:00.000+02:00',
        },
      ]);
      const [shift] = (await database('shifts')
        .insert({
          scheduleID: schedule.id,
          startTime: new Date('2026-08-24T09:00:00.000-07:00'),
          endTime: new Date('2026-08-24T10:00:00.000-07:00'),
          requiredParticipants: 4,
        })
        .returning('id')) as IDRow[];

      await assert.rejects(
        ShiftController.RegisterParticipantForShift(
          shift.id,
          users[0].id,
          database,
        ),
        (error: unknown) =>
          error instanceof ShiftSignupError &&
          error.status === 403 &&
          /roster members/i.test(error.message),
      );
      await assert.rejects(
        ShiftController.RegisterParticipantForShift(
          shift.id,
          users[1].id,
          database,
        ),
        (error: unknown) =>
          error instanceof ShiftSignupError &&
          error.status === 409 &&
          /attendance window/i.test(error.message),
      );
      await assert.rejects(
        ShiftController.RegisterParticipantForShift(
          shift.id,
          users[2].id,
          database,
        ),
        (error: unknown) =>
          error instanceof ShiftSignupError &&
          error.status === 409 &&
          /attendance window/i.test(error.message),
      );
      assert.deepEqual(
        await ShiftController.RegisterParticipantForShift(
          shift.id,
          users[3].id,
          database,
        ),
        { registeredShiftIDs: [shift.id] },
      );
    } finally {
      await destroyTestDatabase(adminDatabase, database, schemaName);
    }
  },
);

test('overlap checks use absolute instants and allow adjacent shifts', () => {
  assert.equal(
    shiftTimeRangesOverlap(
      {
        startTime: '2026-08-24T23:30:00-07:00',
        endTime: '2026-08-25T01:00:00-07:00',
      },
      {
        startTime: '2026-08-25T00:30:00-07:00',
        endTime: '2026-08-25T01:30:00-07:00',
      },
    ),
    true,
  );
  assert.equal(
    shiftTimeRangesOverlap(
      {
        startTime: '2026-08-24T23:30:00-07:00',
        endTime: '2026-08-25T01:00:00-07:00',
      },
      {
        startTime: '2026-08-25T08:00:00Z',
        endTime: '2026-08-25T09:00:00Z',
      },
    ),
    false,
  );
  assert.throws(
    () =>
      shiftTimeRangesOverlap(
        { startTime: 'invalid', endTime: '2026-08-25T01:00:00Z' },
        {
          startTime: '2026-08-25T01:00:00Z',
          endTime: '2026-08-25T02:00:00Z',
        },
      ),
    /valid start and end times/,
  );
});

test('shift IDs must be strict positive safe integers', () => {
  assert.equal(parseShiftID('1'), 1);
  assert.equal(parseShiftID('42'), 42);

  ['1junk', '1.5', '1e2', '0', '-1', '', '9007199254740992'].forEach(
    (value) => {
      assert.throws(
        () => parseShiftID(value),
        (error: unknown) =>
          error instanceof ShiftSignupError && error.status === 400,
      );
    },
  );
});
