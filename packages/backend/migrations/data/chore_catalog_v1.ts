export type ChoreCatalogKind = 'chore' | 'event' | 'dinner';

export interface ChoreCatalogSeedRow {
  stableKey: string;
  kind: ChoreCatalogKind;
  shiftLabel: string;
  positionLabel: string;
  dayMode: 'template' | 'explicit';
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: number;
  sourceOrder: number;
  score: number;
}

// These hashes pin the exact CSV responses reviewed on 2026-08-05. They are
// documentation only; the running application never fetches the workbook.
export const CHORE_CATALOG_V1_SOURCE = {
  sheetID: '12QBFgX_jb9vdli-txNK4M2nkMt7TZ_FCHtX_gbEG9BM',
  choreTab: 'Chore template (One day)',
  choreSHA256:
    '78533d7bef2de145afd20be3e3d8376d116405e947558db6b097b13a50a87c99',
  eventTab: 'Event scores table (Week)',
  eventSHA256:
    'b4b71cf171823ddd4aac697c0c1d38c51150ee5e8abdb75a1a4d4b5701792de5',
  dinnerTab: 'Dinner scores table (Week)',
  dinnerSHA256:
    '4fb719a8549e81bed82b968b709b7335032e9de288464e62ab83f8eff06e3b42',
} as const;

type DayLabel =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

interface Timing {
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
}

interface PositionScore {
  positionLabel: string;
  score: number;
}

interface EventPeriod {
  dayNumber: number;
  dayLabel: DayLabel;
  timePeriodLabel: string;
  positions: ReadonlyArray<{
    shiftLabel: string;
    positionLabel: string;
    score: number;
  }>;
}

const DAY_NUMBERS: Record<DayLabel, number> = {
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
  Saturday: 7,
};

const POSITION_LABELS = ['First', 'Second', 'Third', 'Fourth'] as const;

const CHORE_SHIFTS = [
  {
    timePeriodLabel: '11:00:00 AM',
    shiftLabel: 'AM Chum Wench',
    scores: [100, 50, 25, 5],
  },
  {
    timePeriodLabel: '6:00:00 PM',
    shiftLabel: 'PM Chum Wench',
    scores: [100, 50, 25, 5],
  },
  {
    timePeriodLabel: '11:00:00 AM',
    shiftLabel: 'AM Ice Bitch',
    scores: [100, 50, 10, 1],
  },
  {
    timePeriodLabel: '4:00:00 PM',
    shiftLabel: 'PM Ice Bitch',
    scores: [100, 50, 10, 1],
  },
  {
    timePeriodLabel: '11:00:00 AM',
    shiftLabel: 'Pantry Ho',
    scores: [100, 50, 25, 3],
  },
  {
    timePeriodLabel: '11:00:00 AM',
    shiftLabel: 'AM MOOP + Trash',
    scores: [100, 50, 25, 5],
  },
  {
    timePeriodLabel: '6:00:00 PM',
    shiftLabel: 'PM MOOP + Trash',
    scores: [100, 50, 25, 5],
  },
  {
    timePeriodLabel: '7:00:00 PM',
    shiftLabel: 'Dinner Serve',
    scores: [100, 50, 10, 1],
  },
] as const;

const DAY_EVENT_POSITIONS: PositionScore[] = [
  { positionLabel: 'Manager', score: 100 },
  { positionLabel: 'Bartender', score: 100 },
  { positionLabel: 'Bouncer', score: 2 },
  { positionLabel: 'Float', score: 1 },
];

const NIGHT_EVENT_POSITIONS = [
  { shiftLabel: 'Audio', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Bartender', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Bouncer', score: 90 },
  { shiftLabel: 'Bar', positionLabel: 'Float', score: 75 },
  { shiftLabel: 'Fire', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Fire', positionLabel: 'Bouncer 1', score: 100 },
  { shiftLabel: 'Fire', positionLabel: 'Bouncer 2', score: 25 },
  { shiftLabel: 'LED', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'LED', positionLabel: 'Float', score: 25 },
] as const;

const AFTER_MIDNIGHT_EVENT_POSITIONS = [
  { shiftLabel: 'Audio', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Bartender', score: 100 },
  { shiftLabel: 'Bar', positionLabel: 'Bouncer', score: 80 },
  { shiftLabel: 'Bar', positionLabel: 'Float', score: 50 },
  { shiftLabel: 'Fire', positionLabel: 'Manager', score: 100 },
  { shiftLabel: 'Fire', positionLabel: 'Bouncer 1', score: 100 },
  { shiftLabel: 'Fire', positionLabel: 'Bouncer 2', score: 25 },
  { shiftLabel: 'LED', positionLabel: 'Manager', score: 50 },
  { shiftLabel: 'LED', positionLabel: 'Float', score: 25 },
] as const;

const ZERO_EVENT_POSITIONS: PositionScore[] = [
  { positionLabel: 'Manager', score: 0 },
  { positionLabel: 'Bartender', score: 0 },
  { positionLabel: 'Bouncer', score: 0 },
  { positionLabel: 'Float', score: 0 },
];

const EVENT_WEEKDAYS: DayLabel[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DINNER_DAYS: DayLabel[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Friday',
  'Saturday',
];

const DINNER_SHIFTS = [
  { timePeriodLabel: '4:00 PM', shiftLabel: 'Food Prep' },
  { timePeriodLabel: '5:30 PM', shiftLabel: 'Dinner Cook' },
  { timePeriodLabel: '8:00 PM', shiftLabel: 'Dinner Clean' },
] as const;

const DINNER_POSITIONS: PositionScore[] = [
  { positionLabel: 'First', score: 100 },
  { positionLabel: 'Second', score: 50 },
  { positionLabel: 'Third', score: 25 },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseClock(value: string): { minutes: number; time: string } {
  const match = value
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a|p|am|pm)$/i);

  if (!match) {
    throw new Error(`Invalid catalog clock: ${value}`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const marker = match[3].toLowerCase();
  const hour24 = (hour % 12) + (marker === 'p' || marker === 'pm' ? 12 : 0);

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error(`Invalid catalog clock: ${value}`);
  }

  return {
    minutes: hour24 * 60 + minute,
    time: `${String(hour24).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0',
    )}:00`,
  };
}

function timing(timePeriodLabel: string): Timing {
  const range = timePeriodLabel.match(/^(.+?)-(.+)$/);
  const start = parseClock(range?.[1] ?? timePeriodLabel);
  const end = range
    ? parseClock(range[2])
    : {
        minutes: (start.minutes + 60) % (24 * 60),
        time: `${String(
          Math.floor(((start.minutes + 60) % 1440) / 60),
        ).padStart(
          2,
          '0',
        )}:${String((start.minutes + 60) % 60).padStart(2, '0')}:00`,
      };

  return {
    startLocalTime: start.time,
    endLocalTime: end.time,
    endDayOffset: end.minutes <= start.minutes ? 1 : 0,
  };
}

function barPositions(positions: ReadonlyArray<PositionScore>) {
  return positions.map((position) => ({
    shiftLabel: 'Bar',
    ...position,
  }));
}

function eventPeriod(
  dayLabel: DayLabel,
  timePeriodLabel: string,
  positions: EventPeriod['positions'],
  dayNumber = DAY_NUMBERS[dayLabel],
): EventPeriod {
  return { dayNumber, dayLabel, timePeriodLabel, positions };
}

const EVENT_PERIODS: EventPeriod[] = [
  eventPeriod('Sunday', '6p-9p', barPositions(DAY_EVENT_POSITIONS)),
  eventPeriod('Sunday', '9p-12a', NIGHT_EVENT_POSITIONS),
  ...EVENT_WEEKDAYS.flatMap((dayLabel) => [
    eventPeriod(dayLabel, '12a-3a', AFTER_MIDNIGHT_EVENT_POSITIONS),
    eventPeriod(dayLabel, '3a-6a', barPositions(ZERO_EVENT_POSITIONS)),
    eventPeriod(dayLabel, '12p-3p', barPositions(DAY_EVENT_POSITIONS)),
    eventPeriod(dayLabel, '3p-6p', barPositions(DAY_EVENT_POSITIONS)),
    eventPeriod(dayLabel, '6p-9p', barPositions(DAY_EVENT_POSITIONS)),
    eventPeriod(dayLabel, '9p-12a', NIGHT_EVENT_POSITIONS),
  ]),
  eventPeriod('Sunday', '12a-3a', AFTER_MIDNIGHT_EVENT_POSITIONS, 8),
];

const choreRows: ChoreCatalogSeedRow[] = POSITION_LABELS.flatMap(
  (positionLabel, positionIndex) =>
    CHORE_SHIFTS.map((shift) => ({
      stableKey: `chore-${slug(shift.shiftLabel)}-${slug(positionLabel)}`,
      kind: 'chore' as const,
      shiftLabel: shift.shiftLabel,
      positionLabel,
      dayMode: 'template' as const,
      dayNumber: null,
      dayLabel: null,
      timePeriodLabel: shift.timePeriodLabel,
      periodOrder: null,
      ...timing(shift.timePeriodLabel),
      sourceOrder: positionIndex * CHORE_SHIFTS.length,
      score: shift.scores[positionIndex],
    })),
).map((row, sourceOrder) => ({ ...row, sourceOrder }));

const eventRows: ChoreCatalogSeedRow[] = EVENT_PERIODS.flatMap(
  (period, periodIndex) =>
    period.positions.map(({ shiftLabel, positionLabel, score }) => ({
      stableKey:
        `event-${String(periodIndex + 1).padStart(2, '0')}-` +
        `${slug(shiftLabel)}-${slug(positionLabel)}`,
      kind: 'event' as const,
      shiftLabel,
      positionLabel,
      dayMode: 'explicit' as const,
      dayNumber: period.dayNumber,
      dayLabel: period.dayLabel,
      timePeriodLabel: period.timePeriodLabel,
      periodOrder: periodIndex + 1,
      ...timing(period.timePeriodLabel),
      sourceOrder: 0,
      score,
    })),
).map((row, sourceOrder) => ({ ...row, sourceOrder }));

const dinnerRows: ChoreCatalogSeedRow[] = DINNER_DAYS.flatMap((dayLabel) =>
  DINNER_SHIFTS.flatMap((shift) =>
    DINNER_POSITIONS.map(({ positionLabel, score }) => ({
      stableKey: `dinner-${slug(dayLabel)}-${slug(shift.shiftLabel)}-${slug(
        positionLabel,
      )}`,
      kind: 'dinner' as const,
      shiftLabel: shift.shiftLabel,
      positionLabel,
      dayMode: 'explicit' as const,
      dayNumber: DAY_NUMBERS[dayLabel],
      dayLabel,
      timePeriodLabel: shift.timePeriodLabel,
      periodOrder: null,
      ...timing(shift.timePeriodLabel),
      sourceOrder: 0,
      score,
    })),
  ),
).map((row, sourceOrder) => ({ ...row, sourceOrder }));

export const CHORE_CATALOG_V1: ChoreCatalogSeedRow[] = [
  ...choreRows,
  ...eventRows,
  ...dinnerRows,
];

const stableKeys = new Set(CHORE_CATALOG_V1.map(({ stableKey }) => stableKey));

if (
  choreRows.length !== 32 ||
  eventRows.length !== 240 ||
  dinnerRows.length !== 54 ||
  stableKeys.size !== CHORE_CATALOG_V1.length
) {
  throw new Error('Chore catalog v1 failed its static integrity check.');
}
