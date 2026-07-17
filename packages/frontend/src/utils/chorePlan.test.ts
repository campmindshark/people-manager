import {
  allocateChoreSlots,
  buildChorePlan,
  parseGoogleSheetID,
  scoreRowsFromCSV,
} from 'backend/utils/chorePlan';
import { ChoreScoreRow } from 'backend/view_models/chore_plan';

const positions = (
  shift: string,
  timePeriod: string,
  scores: number[],
  extra: Partial<ChoreScoreRow> = {},
): ChoreScoreRow[] =>
  scores.map((score, sourceOrder) => ({
    shift,
    position: `Position ${sourceOrder + 1}`,
    score,
    timePeriod,
    sourceOrder,
    ...extra,
  }));

describe('scoreRowsFromCSV', () => {
  it('normalizes weekday, time, score, and position columns', () => {
    const rows = scoreRowsFromCSV(
      'Day,Time,Shift,Position,Score\r\nSunday,4:00 PM,Food Prep,First,100',
    );

    expect(rows).toEqual([
      {
        shift: 'Food Prep',
        position: 'First',
        score: 100,
        day: 1,
        dayLabel: 'Sunday',
        timePeriod: '4:00 PM',
        periodOrder: undefined,
        sourceOrder: 0,
      },
    ]);
  });

  it('only accepts docs.google.com spreadsheet links', () => {
    expect(
      parseGoogleSheetID(
        'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      ),
    ).toBe('sheet_123');
    expect(() =>
      parseGoogleSheetID('https://example.com/spreadsheets/d/sheet_123/edit'),
    ).toThrow('valid Google Sheets link');
  });
});

describe('allocateChoreSlots', () => {
  it('keeps lower-count event selections when capacity grows', () => {
    const rows = [
      ...positions('Bar', '12p-3p', [100, 50], { periodOrder: 1 }),
      ...positions('Audio', '9p-12a', [90, 25], { periodOrder: 4 }),
    ];
    const smaller = allocateChoreSlots(rows, 3, 'event').selected;
    const larger = allocateChoreSlots(rows, 5, 'event').selected;

    expect(larger.slice(0, smaller.length)).toEqual(smaller);
  });

  it('does not repeat the full-week dinner template', () => {
    const rows = positions('Dinner Cook', '5:30 PM', [100, 50], {
      day: 1,
      dayLabel: 'Sunday',
    });
    const allocation = allocateChoreSlots(rows, 3, 'dinner');

    expect(allocation.selected).toHaveLength(2);
    expect(allocation.shortage).toBe(1);
  });
});

describe('buildChorePlan', () => {
  it('maps the seven-day score model onto the roster year in Pacific time', () => {
    const preview = buildChorePlan({
      rosterID: 7,
      year: 2026,
      camperCount: 1,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      sheetTitle: 'MindShark Chore Scores',
      requirements: { chore: 3, event: 3, dinner: 1 },
      chores: positions('AM Chum Wench', '11:00:00 AM', [100, 50, 25]),
      events: positions('Bar', '12a-3a', [100, 50, 25], {
        periodOrder: 5,
      }),
      dinners: positions('Food Prep', '4:00 PM', [100], {
        day: 1,
        dayLabel: 'Sunday',
      }),
    });

    expect(preview.categories.chore).toEqual({
      target: 3,
      selected: 3,
      shortage: 0,
    });
    expect(preview.categories.event).toEqual({
      target: 3,
      selected: 3,
      shortage: 0,
    });
    expect(preview.categories.dinner).toEqual({
      target: 1,
      selected: 1,
      shortage: 0,
    });

    const firstChore = preview.shifts.find((shift) => shift.kind === 'chore');
    const firstOvernightEvent = preview.shifts.find(
      (shift) => shift.kind === 'event',
    );
    expect(firstChore?.startTime).toBe('2026-08-30T18:00:00.000Z');
    expect(firstChore?.slots).toEqual([{ position: 'Position 1', score: 100 }]);
    expect(firstOvernightEvent?.startTime).toBe('2026-08-31T07:00:00.000Z');
    expect(firstOvernightEvent?.endTime).toBe('2026-08-31T10:00:00.000Z');
  });

  it('uses the configurable per-camper requirements for capacity targets', () => {
    const preview = buildChorePlan({
      rosterID: 7,
      year: 2026,
      camperCount: 2,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      sheetTitle: 'MindShark Chore Scores',
      requirements: { chore: 2, event: 1, dinner: 0 },
      chores: positions('AM Chum Wench', '11:00:00 AM', [100, 50, 25, 10]),
      events: positions('Bar', '12p-3p', [100, 50], { periodOrder: 1 }),
      dinners: positions('Food Prep', '4:00 PM', [100], {
        day: 1,
        dayLabel: 'Sunday',
      }),
    });

    expect(preview.requirements).toEqual({ chore: 2, event: 1, dinner: 0 });
    expect(preview.categories.chore.target).toBe(4);
    expect(preview.categories.event.target).toBe(2);
    expect(preview.categories.dinner.target).toBe(0);
  });
});
