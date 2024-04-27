import { DateTime } from 'luxon';

export const daylightSavingTimeIsActive = (date: Date): boolean => {
  const marchDate = new Date(date.getFullYear(), 3, 10);
  const novemberDate = new Date(date.getFullYear(), 11, 3);

  return date < novemberDate && date > marchDate;
};

export function utcDateToDateTimeInTimezone(
  utcDate: Date,
  timeZone: string,
): DateTime {
  let dateTime = DateTime.fromISO(utcDate.toISOString(), { zone: 'utc' })
    .toUTC()
    .setZone(timeZone);

  if (daylightSavingTimeIsActive(new Date())) {
    dateTime = dateTime.plus({ hours: 0 });
  }

  return dateTime;
}

export function dateToUTCDate(d: Date): Date {
  return DateTime.fromJSDate(d)
    .setZone('utc', { keepLocalTime: true })
    .toJSDate();
}
