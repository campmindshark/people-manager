import { DateTime } from 'luxon';
import { BM_TIMEZONE } from 'backend/utils/burnDates';

// Convert a UTC date to a DateTime object in a specific timezone.
// The utcDate argument will be forced into the UTC timezone regardless
// of a defined TZ offset.
export default function utcDateToDateTimeInTimezone(
  utcDate: Date,
  timeZone: string,
): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(timeZone);
}

export function eventCalendarDate(
  year: number,
  month: number,
  day: number,
): Date {
  return DateTime.fromObject({ year, month, day }, { zone: BM_TIMEZONE })
    .startOf('day')
    .toJSDate();
}

export function startOfEventDay(date: Date): Date {
  return DateTime.fromJSDate(date)
    .setZone(BM_TIMEZONE)
    .startOf('day')
    .toJSDate();
}

export function endOfEventDay(date: Date): Date {
  return DateTime.fromJSDate(date).setZone(BM_TIMEZONE).endOf('day').toJSDate();
}

export function addEventCalendarDays(date: Date, days: number): Date {
  return DateTime.fromJSDate(date)
    .setZone(BM_TIMEZONE)
    .plus({ days })
    .toJSDate();
}

export function browserLocalInputToEventTime(
  value: string,
  browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Date {
  const browserDateTime = DateTime.fromISO(value, { zone: browserTimeZone });
  if (!browserDateTime.isValid) {
    throw new Error('Event time must be a valid Pacific date and time.');
  }

  return DateTime.fromObject(
    {
      year: browserDateTime.year,
      month: browserDateTime.month,
      day: browserDateTime.day,
      hour: browserDateTime.hour,
      minute: browserDateTime.minute,
      second: browserDateTime.second,
      millisecond: browserDateTime.millisecond,
    },
    { zone: BM_TIMEZONE },
  )
    .toUTC()
    .toJSDate();
}
