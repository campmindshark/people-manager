import { DateTime } from 'luxon';
import { BM_TIMEZONE } from './burnDates';

export default function parseEventDateTime(
  value: unknown,
  fieldName: string,
): Date {
  let dateTime: DateTime;
  if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value);
  } else if (typeof value === 'string') {
    dateTime = DateTime.fromISO(value, { zone: BM_TIMEZONE });
  } else {
    dateTime = DateTime.invalid('unsupported input');
  }

  if (!dateTime.isValid) {
    throw new Error(`${fieldName} must be a valid Pacific date and time.`);
  }

  return dateTime.toUTC().toJSDate();
}
