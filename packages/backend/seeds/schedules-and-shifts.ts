/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';
import Shift from '../models/shift/shift';

const generateShiftsAtIntervalOverRange = (
  intervalMins: number,
  startTime: Date,
  endTime: Date,
  startID: number,
  targetScheduleID: number,
) => {
  const shifts: Shift[] = [];
  let currTime = new Date(startTime);
  let currentStartID = startID;
  while (currTime < endTime) {
    shifts.push(
      new Shift(
        currentStartID,
        targetScheduleID,
        currTime,
        new Date(currTime.getTime() + intervalMins * 60000),
      ),
    );
    currTime = new Date(currTime.getTime() + intervalMins * 60000);
    currentStartID += 1;
  }

  console.log(`Generated a (${shifts.length}) shifts: \n${shifts}`);
  return shifts;
};

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('schedules').del();
  await knex('shifts').del();

  // Inserts seed entries
  await knex('schedules').insert([
    { id: 1, name: 'Bar Wench', description: 'Prepare the bar for battle.' },
    { id: 2, name: 'Ice Bitch', description: 'Keep us cool.' },
  ]);

  // Add 90 minute shifts for all hours.
  const wenchShifts = generateShiftsAtIntervalOverRange(
    90,
    new Date('August 24, 2024 16:00'),
    new Date('August 29, 2024 18:00'),
    1,
    1,
  );
  await knex('shifts').insert(wenchShifts);

  // Add a couple shifts here and there for the Ice Bitch schedule.
  await knex('shifts').insert([
    {
      id: wenchShifts.length + 1,
      scheduleID: 2,
      startTime: new Date('August 24, 2024 10:00'),
      endTime: new Date('August 24, 2024 11:00'),
    },
    {
      id: wenchShifts.length + 2,
      scheduleID: 2,
      startTime: new Date('August 24, 2024 18:00'),
      endTime: new Date('August 24, 2024 19:00'),
    },
    {
      id: wenchShifts.length + 3,
      scheduleID: 2,
      startTime: new Date('August 25, 2024 10:00'),
      endTime: new Date('August 25, 2024 11:00'),
    },
    {
      id: wenchShifts.length + 4,
      scheduleID: 2,
      startTime: new Date('August 25, 2024 18:00'),
      endTime: new Date('August 25, 2024 19:00'),
    },
    {
      id: wenchShifts.length + 5,
      scheduleID: 2,
      startTime: new Date('August 26, 2024 10:00'),
      endTime: new Date('August 26, 2024 11:00'),
    },
    {
      id: wenchShifts.length + 6,
      scheduleID: 2,
      startTime: new Date('August 26, 2024 18:00'),
      endTime: new Date('August 26, 2024 19:00'),
    },
  ]);
}
