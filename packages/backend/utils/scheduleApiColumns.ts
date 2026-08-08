export const PUBLIC_SCHEDULE_COLUMNS = [
  'schedules.id',
  'schedules.rosterID',
  'schedules.name',
  'schedules.description',
] as const;

export const PUBLIC_SHIFT_COLUMNS = [
  'shifts.id',
  'shifts.scheduleID',
  'shifts.startTime',
  'shifts.endTime',
  'shifts.requiredParticipants',
] as const;
