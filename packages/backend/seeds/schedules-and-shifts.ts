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
  while (currTime < endTime) {
    shifts.push(
      new Shift(
        startID,
        targetScheduleID,
        currTime,
        new Date(currTime.getTime() + intervalMins * 60000),
      ),
    );
    currTime = new Date(currTime.getTime() + intervalMins * 60000);
    startID++;
  }

  console.log(`Generated a (${shifts.length}) shifts: \n` + shifts);
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
  await knex('shifts').insert(
    generateShiftsAtIntervalOverRange(
      90,
      new Date('August 26, 2024 18:00'),
      new Date('August 29, 2024 18:00'),
      1,
      1,
    ),
  );

  // Add a couple shifts here and there.
  await knex('shifts').insert([
    {
      id: 49,
      scheduleID: 2,
      startTime: new Date('August 27, 2024 10:00'),
      endTime: new Date('August 27, 2024 11:00'),
    },
    {
      id: 50,
      scheduleID: 2,
      startTime: new Date('August 27, 2024 18:00'),
      endTime: new Date('August 27, 2024 19:00'),
    },
    {
      id: 51,
      scheduleID: 2,
      startTime: new Date('August 27, 2024 10:00'),
      endTime: new Date('August 27, 2024 11:00'),
    },
    {
      id: 52,
      scheduleID: 2,
      startTime: new Date('August 27, 2024 18:00'),
      endTime: new Date('August 27, 2024 19:00'),
    },
    {
      id: 53,
      scheduleID: 2,
      startTime: new Date('August 28, 2024 10:00'),
      endTime: new Date('August 28, 2024 11:00'),
    },
    {
      id: 54,
      scheduleID: 2,
      startTime: new Date('August 28, 2024 18:00'),
      endTime: new Date('August 28, 2024 19:00'),
    },
  ]);
}
