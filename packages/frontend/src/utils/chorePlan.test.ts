import {
  allocateChoreSlots,
  buildChorePlan,
  fetchScoreSheet,
  parseGoogleSheetID,
  scoreRowsFromCSV,
} from 'backend/utils/chorePlan';
import { shiftTimeRangeContains } from 'backend/utils/shiftTime';
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

describe('fetchScoreSheet', () => {
  it('loads the current weekly event tab without cached responses', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (
        input: RequestInfo | URL,
        _init?: RequestInit,
      ): Promise<Response> => {
        const url = String(input);
        let body = 'Time,Shift,Position,Score\n11:00 AM,Chum Wench,First,100';
        if (url.endsWith('/edit')) {
          body = '<meta property="og:title" content="MindShark Chore Scores">';
        } else if (url.includes('Event%20scores%20table%20(Week)')) {
          body =
            'Period order label,Day,Time period,Shift,Position,Score\n1,Sunday,6p-9p,Bar,Bouncer,2';
        } else if (url.includes('Dinner%20scores%20table%20(Week)')) {
          body =
            'Day,Time,Shift,Position,Score\nSunday,4:00 PM,Food Prep,First,100';
        }
        return {
          ok: true,
          text: async () => body,
        } as Response;
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const sheet = await fetchScoreSheet(
        'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      );
      expect(sheet.events[0]).toMatchObject({
        day: 1,
        periodOrder: 1,
        score: 2,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const eventRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('Event%20scores%20table%20(Week)'),
    );
    expect(eventRequest?.[1]).toMatchObject({
      cache: 'no-store',
      headers: expect.objectContaining({ 'Cache-Control': 'no-cache' }),
    });
    expect(String(eventRequest?.[0])).toMatch(/cacheBuster=\d+/);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('Event%20template%20(One%20day)'),
      ),
    ).toBe(false);
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

  it('uses weighted full-week event rows without repeating them', () => {
    const rows = [
      ...positions('Bar', '6p-9p', [2], {
        day: 1,
        dayLabel: 'Sunday',
        periodOrder: 1,
      }),
      ...positions('Bar', '12p-3p', [100], {
        day: 2,
        dayLabel: 'Monday',
        periodOrder: 5,
      }),
    ];
    const allocation = allocateChoreSlots(rows, 3, 'event');

    expect(allocation.selected).toHaveLength(2);
    expect(allocation.shortage).toBe(1);
    expect(allocation.selected[0]).toMatchObject({
      day: 2,
      calendarDay: 2,
      score: 100,
    });
    expect(allocation.selected[1]).toMatchObject({
      day: 1,
      calendarDay: 1,
      score: 2,
    });
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
      events: [
        ...positions('Daytime marker', '12p-3p', [0], { periodOrder: 1 }),
        ...positions('Bar', '12a-3a', [100, 50, 25], {
          periodOrder: 5,
        }),
      ],
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

  it('uses period order to keep the first Sunday period at the start of the week', () => {
    const preview = buildChorePlan({
      rosterID: 7,
      year: 2026,
      camperCount: 1,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      sheetTitle: 'MindShark Chore Scores',
      requirements: { chore: 0, event: 2, dinner: 0 },
      chores: [],
      events: [
        ...positions('Bar', '12a-3a', [100], { periodOrder: 1 }),
        ...positions('Bar', '12p-3p', [100], { periodOrder: 2 }),
      ],
      dinners: [],
    });

    const firstPeriod = preview.shifts.find(
      (shift) => shift.kind === 'event' && shift.periodOrder === 1,
    );
    expect(firstPeriod).toMatchObject({
      day: 1,
      dayLabel: 'Sunday, Aug 30',
      startTime: '2026-08-30T07:00:00.000Z',
      endTime: '2026-08-30T10:00:00.000Z',
    });
  });

  it('keeps the closing Sunday overnight periods in the Saturday row with their actual times', () => {
    const preview = buildChorePlan({
      rosterID: 7,
      year: 2026,
      camperCount: 1,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      sheetTitle: 'MindShark Chore Scores',
      requirements: { chore: 0, event: 15, dinner: 0 },
      chores: [],
      events: [
        ...positions('Bar', '12p-3p', [0], { periodOrder: 1 }),
        ...positions('Bar', '12a-3a', [100], { periodOrder: 5 }),
        ...positions('Bar', '3a-6a', [100], { periodOrder: 6 }),
      ],
      dinners: [],
    });
    const eventShift = (day: number, periodOrder: number) =>
      preview.shifts.find(
        (shift) =>
          shift.kind === 'event' &&
          shift.day === day &&
          shift.periodOrder === periodOrder,
      );
    const openingSunday = eventShift(1, 1);
    const closingSundayMidnight = eventShift(7, 5);
    const closingSundayLate = eventShift(7, 6);
    if (!openingSunday || !closingSundayMidnight || !closingSundayLate) {
      throw new Error('Expected event shifts at both Sunday boundaries.');
    }

    expect(openingSunday).toMatchObject({
      day: 1,
      dayLabel: 'Sunday, Aug 30',
      startTime: '2026-08-30T19:00:00.000Z',
    });
    expect(closingSundayMidnight).toMatchObject({
      day: 7,
      dayLabel: 'Saturday, Sep 5',
      startTime: '2026-09-06T07:00:00.000Z',
      endTime: '2026-09-06T10:00:00.000Z',
    });
    expect(closingSundayLate).toMatchObject({
      day: 7,
      dayLabel: 'Saturday, Sep 5',
      startTime: '2026-09-06T10:00:00.000Z',
      endTime: '2026-09-06T13:00:00.000Z',
    });

    expect(
      shiftTimeRangeContains(
        {
          startTime: '2026-08-30T19:00:00.000Z',
          endTime: '2026-09-06T13:00:00.000Z',
        },
        openingSunday,
      ),
    ).toBe(true);
    expect(
      shiftTimeRangeContains(
        {
          startTime: '2026-08-30T20:00:00.000Z',
          endTime: '2026-09-06T13:00:00.000Z',
        },
        openingSunday,
      ),
    ).toBe(false);
    expect(
      shiftTimeRangeContains(
        {
          startTime: '2026-08-30T19:00:00.000Z',
          endTime: '2026-09-06T12:59:59.000Z',
        },
        closingSundayLate,
      ),
    ).toBe(false);
  });

  it('normalizes the weighted event week into Sunday through Saturday rows', () => {
    const preview = buildChorePlan({
      rosterID: 7,
      year: 2026,
      camperCount: 1,
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      sheetTitle: 'MindShark Chore Scores',
      requirements: { chore: 0, event: 9, dinner: 0 },
      chores: [],
      events: [
        ...positions('Bar', '6p-9p', [1], {
          day: 1,
          dayLabel: 'Sunday',
          periodOrder: 1,
        }),
        ...positions('Bar', '9p-12a', [1], {
          day: 1,
          dayLabel: 'Sunday',
          periodOrder: 2,
        }),
        ...positions('Bar', '12a-3a', [1], {
          day: 2,
          dayLabel: 'Monday',
          periodOrder: 3,
        }),
        ...positions('Bar', '3a-6a', [1], {
          day: 2,
          dayLabel: 'Monday',
          periodOrder: 4,
        }),
        ...positions('Bar', '12p-3p', [1], {
          day: 2,
          dayLabel: 'Monday',
          periodOrder: 5,
        }),
        ...positions('Bar', '3p-6p', [1], {
          day: 2,
          dayLabel: 'Monday',
          periodOrder: 6,
        }),
        ...positions('Bar', '6p-9p', [1], {
          day: 7,
          dayLabel: 'Saturday',
          periodOrder: 37,
        }),
        ...positions('Bar', '9p-12a', [1], {
          day: 7,
          dayLabel: 'Saturday',
          periodOrder: 38,
        }),
        ...positions('Bar', '12a-3a', [100], {
          day: 1,
          dayLabel: 'Sunday',
          periodOrder: 39,
        }),
      ],
      dinners: [],
    });
    const eventShift = (day: number, periodOrder: number) =>
      preview.shifts.find(
        (shift) =>
          shift.kind === 'event' &&
          shift.day === day &&
          shift.periodOrder === periodOrder,
      );
    const sundayEvening = eventShift(1, 3);
    const sundayOvernight = eventShift(1, 5);
    const closingSunday = eventShift(7, 5);
    if (!sundayEvening || !sundayOvernight || !closingSunday) {
      throw new Error('Expected normalized event-week shifts.');
    }

    expect(sundayEvening).toMatchObject({
      dayLabel: 'Sunday, Aug 30',
      timePeriod: '6p-9p',
      startTime: '2026-08-31T01:00:00.000Z',
    });
    expect(sundayOvernight).toMatchObject({
      dayLabel: 'Sunday, Aug 30',
      timePeriod: '12a-3a',
      startTime: '2026-08-31T07:00:00.000Z',
    });
    expect(closingSunday).toMatchObject({
      dayLabel: 'Saturday, Sep 5',
      timePeriod: '12a-3a',
      startTime: '2026-09-06T07:00:00.000Z',
      endTime: '2026-09-06T10:00:00.000Z',
      slots: [{ position: 'Position 1', score: 100 }],
    });
    expect(closingSunday.key).toBe('event|7|5|12a-3a|Bar');
  });
});
