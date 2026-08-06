import { DateTime } from 'luxon';

// Convert a UTC date to a DateTime object in a specific timezone.
// The utcDate argument will be forced into the UTC timezone regardless
// of a defined TZ offset.
export default function utcDateToDateTimeInTimezone(
  utcDate: Date,
  timeZone: string,
): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(timeZone);
}
