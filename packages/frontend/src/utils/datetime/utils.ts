import { DateTime } from 'luxon';

export const daylightSavingTimeIsActive = (date: Date): boolean => {
  const marchDate = new Date(date.getFullYear(), 3, 10);
  const novemberDate = new Date(date.getFullYear(), 11, 3);

  return date < novemberDate && date > marchDate;
};

// Convert a UTC date to a DateTime object in a specific timezone.
// The utcDate argument will be forced into the UTC timezone regardless
// of a defined TZ offset.
export function utcDateToDateTimeInTimezone(
  utcDate: Date,
  timeZone: string,
): DateTime {
  let dateTime = DateTime.fromJSDate(utcDate)
    .setZone('utc', { keepLocalTime: true })
    .setZone(timeZone);

  if (daylightSavingTimeIsActive(new Date())) {
    dateTime = dateTime.plus({ hours: 0 });
  }

  return dateTime;
}
