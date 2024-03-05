/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';
import { DateTime } from 'luxon';

const timezone = 'America/Los_Angeles';

// getBMTime expects a string in the format "MMMM dd, yyyy hh:mm". ex. (August 24, 2024 10:00)
const getBMTime = (time: string) =>
  DateTime.fromFormat(time, 'MMMM dd, yyyy hh:mm').setZone(timezone).toJSDate();

const generateShiftsAtIntervalOverRange = (
  intervalMins: number,
  startTime: Date,
  endTime: Date,
  startID: number,
  targetScheduleID: number,
) => {
  const shifts: object[] = [];
  let currTime = startTime;
  let currentStartID = startID;
  while (currTime < endTime) {
    shifts.push({
      id: currentStartID,
      scheduleID: targetScheduleID,
      startTime: currTime,
      endTime: new Date(currTime.getTime() + intervalMins * 60000),
      requiredParticipants: 2,
    });
    currTime = new Date(currTime.getTime() + intervalMins * 60000);
    currentStartID += 1;
  }

  return shifts;
};

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('schedules').del();
  await knex('shifts').del();
  await knex('shift_participants').del();

  // Inserts seed entries
  await knex('schedules').insert([
    { id: 1, name: 'Bar Wench', description: 'Prepare the bar for battle.' },
    { id: 2, name: 'Ice Bitch', description: 'Keep us cool.' },
  ]);

  // Add 90 minute shifts for all hours.
  const wenchShifts = generateShiftsAtIntervalOverRange(
    90,
    getBMTime('August 24, 2024 16:00'),
    getBMTime('August 29, 2024 18:00'),
    1,
    1,
  );
  await knex('shifts').insert(wenchShifts);

  DateTime.fromFormat('August 24, 2024 10:00', 'MMMM dd, yyyy hh:mm').setZone(
    timezone,
  );

  // Add a couple shifts here and there for the Ice Bitch schedule.
  const iceShifts = [
    {
      id: wenchShifts.length + 1,
      scheduleID: 2,
      startTime: getBMTime('August 24, 2024 10:00'),
      endTime: getBMTime('August 24, 2024 11:00'),
      requiredParticipants: 2,
    },
    {
      id: wenchShifts.length + 2,
      scheduleID: 2,
      startTime: getBMTime('August 24, 2024 18:00'),
      endTime: getBMTime('August 24, 2024 19:00'),
      requiredParticipants: 2,
    },
    {
      id: wenchShifts.length + 3,
      scheduleID: 2,
      startTime: getBMTime('August 25, 2024 10:00'),
      endTime: getBMTime('August 25, 2024 11:00'),
      requiredParticipants: 2,
    },
    {
      id: wenchShifts.length + 4,
      scheduleID: 2,
      startTime: getBMTime('August 25, 2024 18:00'),
      endTime: getBMTime('August 25, 2024 19:00'),
      requiredParticipants: 2,
    },
    {
      id: wenchShifts.length + 5,
      scheduleID: 2,
      startTime: getBMTime('August 26, 2024 10:00'),
      endTime: getBMTime('August 26, 2024 11:00'),
      requiredParticipants: 2,
    },
    {
      id: wenchShifts.length + 6,
      scheduleID: 2,
      startTime: getBMTime('August 26, 2024 18:00'),
      endTime: getBMTime('August 26, 2024 19:00'),
      requiredParticipants: 2,
    },
  ];
  console.log(iceShifts);
  await knex('shifts').insert(iceShifts);
}
