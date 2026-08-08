import { Knex } from 'knex';
import { DateTime } from 'luxon';
import { BM_TIMEZONE } from './burnDates';

export const ATTENDANCE_TIMESTAMP_FORMAT_COLUMN = 'attendanceTimestampFormat';
export const ABSOLUTE_ATTENDANCE_TIMESTAMP_INPUT = 'absolute-input';

export interface RosterAttendanceTimestampWrite {
  estimatedArrivalDate: Date;
  estimatedDepartureDate: Date;
  attendanceTimestampFormat?: typeof ABSOLUTE_ATTENDANCE_TIMESTAMP_INPUT;
}

export function toLegacyRosterAttendanceTimestamp(timestamp: Date): Date {
  return DateTime.fromJSDate(timestamp, { zone: 'UTC' })
    .setZone(BM_TIMEZONE, { keepLocalTime: true })
    .toJSDate();
}

export async function prepareRosterAttendanceTimestampWrite(
  knex: Knex,
  estimatedArrivalDate: Date,
  estimatedDepartureDate: Date,
): Promise<RosterAttendanceTimestampWrite> {
  const formatMarkerExists = await knex.schema.hasColumn(
    'roster_participants',
    ATTENDANCE_TIMESTAMP_FORMAT_COLUMN,
  );

  if (formatMarkerExists) {
    return {
      estimatedArrivalDate,
      estimatedDepartureDate,
      attendanceTimestampFormat: ABSOLUTE_ATTENDANCE_TIMESTAMP_INPUT,
    };
  }

  // Production deploys the application before running migrations. Until the
  // marker exists, emit the representation expected by the legacy backfill so
  // a write made by the new application is normalized exactly once.
  return {
    estimatedArrivalDate:
      toLegacyRosterAttendanceTimestamp(estimatedArrivalDate),
    estimatedDepartureDate: toLegacyRosterAttendanceTimestamp(
      estimatedDepartureDate,
    ),
  };
}
