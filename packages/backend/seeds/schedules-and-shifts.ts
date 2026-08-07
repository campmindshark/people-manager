/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';
import { DateTime } from 'luxon';

const timezone = 'America/Los_Angeles';

interface IDRow {
  id: number;
}

interface ScheduleFixture {
  rosterID: number;
  name: string;
  description: string;
}

interface ShiftFixture {
  startTime: Date;
  endTime: Date;
  requiredParticipants: number;
}

// getBMTime expects a string in the format "MMMM dd, yyyy hh:mm". ex. (August 24, 2024 10:00)
const getBMTime = (time: string) =>
  DateTime.fromFormat(time, 'MMMM dd, yyyy hh:mm').setZone(timezone).toJSDate();

const generateShiftsAtIntervalOverRange = (
  intervalMins: number,
  startTime: Date,
  endTime: Date,
) => {
  const shifts: ShiftFixture[] = [];
  let currTime = startTime;
  while (currTime < endTime) {
    shifts.push({
      startTime: currTime,
      endTime: new Date(currTime.getTime() + intervalMins * 60000),
      requiredParticipants: 2,
    });
    currTime = new Date(currTime.getTime() + intervalMins * 60000);
  }

  return shifts;
};

async function upsertFixtureSchedule(
  knex: Knex.Transaction,
  fixture: ScheduleFixture,
): Promise<number> {
  const existing = (await knex('schedules')
    .select('id')
    .where({ rosterID: fixture.rosterID, name: fixture.name })
    .whereNull('chorePlanID')
    .orderBy('id')
    .first()) as IDRow | undefined;
  if (existing) {
    await knex('schedules')
      .where({ id: existing.id })
      .update({ description: fixture.description });
    return existing.id;
  }

  const [created] = (await knex('schedules')
    .insert(fixture)
    .returning('id')) as IDRow[];
  return created.id;
}

async function upsertFixtureShift(
  knex: Knex.Transaction,
  scheduleID: number,
  fixture: ShiftFixture,
): Promise<void> {
  const existing = (await knex('shifts')
    .select('id')
    .where({
      scheduleID,
      startTime: fixture.startTime,
      endTime: fixture.endTime,
    })
    .whereNull('plannerKey')
    .orderBy('id')
    .first()) as IDRow | undefined;
  if (existing) {
    await knex('shifts')
      .where({ id: existing.id })
      .update({ requiredParticipants: fixture.requiredParticipants });
    return;
  }

  await knex('shifts').insert({ scheduleID, ...fixture });
}

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (transaction) => {
    const barScheduleID = await upsertFixtureSchedule(transaction, {
      rosterID: 1,
      name: 'Bar Wench',
      description: 'Prepare the bar for battle.',
    });
    const iceScheduleID = await upsertFixtureSchedule(transaction, {
      rosterID: 1,
      name: 'Ice Bitch',
      description: 'Keep us cool.',
    });

    const barShifts = generateShiftsAtIntervalOverRange(
      90,
      getBMTime('August 24, 2024 16:00'),
      getBMTime('August 29, 2024 18:00'),
    );
    const iceShifts: ShiftFixture[] = [
      ['August 24, 2024 10:00', 'August 24, 2024 11:00'],
      ['August 24, 2024 18:00', 'August 24, 2024 19:00'],
      ['August 25, 2024 10:00', 'August 25, 2024 11:00'],
      ['August 25, 2024 18:00', 'August 25, 2024 19:00'],
      ['August 26, 2024 10:00', 'August 26, 2024 11:00'],
      ['August 26, 2024 18:00', 'August 26, 2024 19:00'],
    ].map(([startTime, endTime]) => ({
      startTime: getBMTime(startTime),
      endTime: getBMTime(endTime),
      requiredParticipants: 2,
    }));

    // Do not delete or replace application-created schedules, generated chore
    // shifts, or participant assignments when refreshing development fixtures.
    await Promise.all(
      barShifts.map((shift) =>
        upsertFixtureShift(transaction, barScheduleID, shift),
      ),
    );
    await Promise.all(
      iceShifts.map((shift) =>
        upsertFixtureShift(transaction, iceScheduleID, shift),
      ),
    );
  });
}
