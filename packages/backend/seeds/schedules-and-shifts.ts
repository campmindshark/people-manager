/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';
import { DateTime } from 'luxon';
import { BM_TIMEZONE } from '../utils/burnDates';

interface PersistedScheduleIdentity {
  id: number;

  rosterID: number;

  name: string;

  description: string | null;

  chorePlanID: number | null;

  plannerKey: string | null;
}

interface ScheduleFixture {
  id: number;
  rosterID: number;
  name: string;
  description: string;
}

interface PersistedShiftIdentity {
  id: number;

  scheduleID: number;

  plannerKey: string | null;

  startTime: Date | string;

  endTime: Date | string;

  requiredParticipants: number;
}

interface ShiftFixture {
  id: number;
  scheduleID: number;
  startTime: Date;
  endTime: Date;
  requiredParticipants: number;
}

// getBMTime expects a string in the format "MMMM dd, yyyy HH:mm". ex. (August 24, 2024 10:00)
const getBMTime = (time: string) =>
  DateTime.fromFormat(time, 'MMMM dd, yyyy HH:mm', {
    zone: BM_TIMEZONE,
  }).toJSDate();

const generateShiftsAtIntervalOverRange = (
  intervalMins: number,
  startTime: Date,
  endTime: Date,
  startID: number,
  scheduleID: number,
) => {
  const shifts: ShiftFixture[] = [];
  let currTime = startTime;
  let currentID = startID;
  while (currTime < endTime) {
    shifts.push({
      id: currentID,
      scheduleID,
      startTime: currTime,
      endTime: new Date(currTime.getTime() + intervalMins * 60000),
      requiredParticipants: 2,
    });
    currTime = new Date(currTime.getTime() + intervalMins * 60000);
    currentID += 1;
  }

  return shifts;
};

async function upsertFixtureSchedule(
  knex: Knex.Transaction,
  fixture: ScheduleFixture,
): Promise<void> {
  const existing = (await knex('schedules')
    .select(
      'id',
      'rosterID',
      'name',
      'description',
      'chorePlanID',
      'plannerKey',
    )
    .where({ id: fixture.id })
    .first()) as PersistedScheduleIdentity | undefined;
  if (existing) {
    if (
      existing.rosterID !== fixture.rosterID ||
      existing.name !== fixture.name ||
      existing.description !== fixture.description ||
      existing.chorePlanID !== null ||
      existing.plannerKey !== null
    ) {
      throw new Error(
        `Schedule fixture ID ${fixture.id} belongs to application data.`,
      );
    }
    return;
  }

  await knex('schedules').insert(fixture);
}

async function upsertFixtureShift(
  knex: Knex.Transaction,
  fixture: ShiftFixture,
): Promise<void> {
  const existing = (await knex('shifts')
    .select(
      'id',
      'scheduleID',
      'plannerKey',
      'startTime',
      'endTime',
      'requiredParticipants',
    )
    .where({ id: fixture.id })
    .first()) as PersistedShiftIdentity | undefined;
  if (existing) {
    if (
      existing.scheduleID !== fixture.scheduleID ||
      existing.plannerKey !== null ||
      new Date(existing.startTime).getTime() !== fixture.startTime.getTime() ||
      new Date(existing.endTime).getTime() !== fixture.endTime.getTime() ||
      existing.requiredParticipants !== fixture.requiredParticipants
    ) {
      throw new Error(
        `Shift fixture ID ${fixture.id} belongs to application data.`,
      );
    }
    return;
  }

  await knex('shifts').insert(fixture);
}

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (transaction) => {
    // Sequence repair must observe every allocated application ID. This lock
    // waits for current writers and excludes new schedule/shift writers until
    // both the fixture upserts and setval calls commit.
    await transaction.raw(`
      LOCK TABLE "schedules", "shifts" IN SHARE ROW EXCLUSIVE MODE
    `);

    const barScheduleID = 1;
    const iceScheduleID = 2;
    await upsertFixtureSchedule(transaction, {
      id: barScheduleID,
      rosterID: 1,
      name: 'Bar Wench',
      description: 'Prepare the bar for battle.',
    });
    await upsertFixtureSchedule(transaction, {
      id: iceScheduleID,
      rosterID: 1,
      name: 'Ice Bitch',
      description: 'Keep us cool.',
    });

    const barShifts = generateShiftsAtIntervalOverRange(
      90,
      getBMTime('August 24, 2024 16:00'),
      getBMTime('August 29, 2024 18:00'),
      1,
      barScheduleID,
    );
    const iceShifts: ShiftFixture[] = [
      ['August 24, 2024 10:00', 'August 24, 2024 11:00'],
      ['August 24, 2024 18:00', 'August 24, 2024 19:00'],
      ['August 25, 2024 10:00', 'August 25, 2024 11:00'],
      ['August 25, 2024 18:00', 'August 25, 2024 19:00'],
      ['August 26, 2024 10:00', 'August 26, 2024 11:00'],
      ['August 26, 2024 18:00', 'August 26, 2024 19:00'],
    ].map(([startTime, endTime], index) => ({
      id: barShifts.length + index + 1,
      scheduleID: iceScheduleID,
      startTime: getBMTime(startTime),
      endTime: getBMTime(endTime),
      requiredParticipants: 2,
    }));

    // Do not delete or replace application-created schedules, generated chore
    // shifts, or participant assignments when refreshing development fixtures.
    await Promise.all(
      barShifts.map((shift) => upsertFixtureShift(transaction, shift)),
    );
    await Promise.all(
      iceShifts.map((shift) => upsertFixtureShift(transaction, shift)),
    );

    // The fixture IDs are reserved and validated above. Keep both sequences
    // above every fixture and preserved application row before releasing the
    // writer lock.
    await transaction.raw(`
      SELECT setval(
        pg_get_serial_sequence('schedules', 'id'),
        COALESCE(MAX("id"), 1),
        MAX("id") IS NOT NULL
      )
      FROM "schedules"
    `);
    await transaction.raw(`
      SELECT setval(
        pg_get_serial_sequence('shifts', 'id'),
        COALESCE(MAX("id"), 1),
        MAX("id") IS NOT NULL
      )
      FROM "shifts"
    `);
  });
}
