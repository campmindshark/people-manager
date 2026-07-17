import { DateTime } from 'luxon';
import ChorePlanPreview, {
  ChorePlanKind,
  ChorePlanRequirements,
  ChorePlanShiftPreview,
  ChoreScoreRow,
} from '../view_models/chore_plan';
import { BM_TIMEZONE, getBurnDates } from './burnDates';

const SCORE_TABS: Record<ChorePlanKind, string> = {
  chore: 'Chore template (One day)',
  event: 'Event template (One day)',
  dinner: 'Dinner scores table (Week)',
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

interface ScoreSheetData {
  title: string;
  chores: ChoreScoreRow[];
  events: ChoreScoreRow[];
  dinners: ChoreScoreRow[];
}

interface AllocatedSlot extends ChoreScoreRow {
  day: number;
  groupKey: string;
  slotOrder: number;
}

interface AllocationGroup {
  day: number;
  sourceOrder: number;
  slots: AllocatedSlot[];
  selectedCount: number;
}

export interface ChorePlanInput {
  rosterID: number;
  year: number;
  camperCount: number;
  sheetUrl: string;
  sheetTitle: string;
  requirements: ChorePlanRequirements;
  chores: ChoreScoreRow[];
  events: ChoreScoreRow[];
  dinners: ChoreScoreRow[];
}

function decodeHTML(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function parseGoogleSheetID(value: string): string {
  const match = value.match(
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/,
  );
  if (!match) {
    throw new Error('Enter a valid Google Sheets link.');
  }
  return match[1];
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }
      row.push(value);
      value = '';
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function scoreRowsFromCSV(csv: string): ChoreScoreRow[] {
  const [header = [], ...body] = parseCSV(csv);
  const normalizedHeader = header.map((cell) => cell.trim().toLowerCase());
  const column = (name: string) => normalizedHeader.indexOf(name);
  const firstColumn = (...names: string[]) =>
    names.map(column).find((index) => index >= 0) ?? -1;
  const shiftColumn = column('shift');
  const positionColumn = column('position');
  const scoreColumn = column('score');
  const dayColumn = column('day');
  const timePeriodColumn = firstColumn('time period', 'time', 'time of day');
  const periodOrderColumn = column('period order label');

  if (shiftColumn < 0 || positionColumn < 0 || scoreColumn < 0) {
    throw new Error('The tab needs Shift, Position, and Score columns.');
  }

  return body
    .map((cells, sourceOrder) => {
      const dayLabel = dayColumn >= 0 ? cells[dayColumn]?.trim() : undefined;
      const weekdayIndex = dayLabel
        ? WEEKDAYS.indexOf(dayLabel.toLowerCase())
        : -1;
      const numericDay = Number(dayLabel);
      let day: number | undefined;
      if (weekdayIndex >= 0) {
        day = weekdayIndex + 1;
      } else if (Number.isInteger(numericDay) && numericDay > 0) {
        day = numericDay;
      }

      return {
        shift: cells[shiftColumn]?.trim() ?? '',
        position: cells[positionColumn]?.trim() ?? '',
        score: Number(cells[scoreColumn]) || 0,
        day,
        dayLabel,
        timePeriod:
          timePeriodColumn >= 0 ? cells[timePeriodColumn]?.trim() : undefined,
        periodOrder:
          periodOrderColumn >= 0
            ? Number(cells[periodOrderColumn]) || 0
            : undefined,
        sourceOrder,
      };
    })
    .filter((row) => row.shift && row.position);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'people-manager-chore-planner' },
  });
  if (!response.ok) {
    throw new Error(
      'Google could not share this sheet. Set it to anyone-with-link view access.',
    );
  }
  return response.text();
}

export async function fetchScoreSheet(
  sourceUrl: string,
): Promise<ScoreSheetData> {
  const sheetID = parseGoogleSheetID(sourceUrl);
  const pageURL = `https://docs.google.com/spreadsheets/d/${sheetID}/edit`;
  const csvURL = (tab: string) =>
    `https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      tab,
    )}`;

  const [page, choreCSV, eventCSV, dinnerCSV] = await Promise.all([
    fetchText(pageURL),
    fetchText(csvURL(SCORE_TABS.chore)),
    fetchText(csvURL(SCORE_TABS.event)),
    fetchText(csvURL(SCORE_TABS.dinner)),
  ]);

  const parseTab = (tab: string, csv: string) => {
    try {
      const rows = scoreRowsFromCSV(csv);
      if (!rows.length) {
        throw new Error('The tab needs at least one complete row.');
      }
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid tab.';
      throw new Error(`“${tab}”: ${message}`);
    }
  };

  const chores = parseTab(SCORE_TABS.chore, choreCSV);
  const events = parseTab(SCORE_TABS.event, eventCSV);
  const dinners = parseTab(SCORE_TABS.dinner, dinnerCSV);
  if (dinners.some((row) => !row.day)) {
    throw new Error(
      `“${SCORE_TABS.dinner}” needs a recognizable Day value on every row.`,
    );
  }

  return {
    title: decodeHTML(
      page.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ??
        'Google Sheet',
    ),
    chores,
    events,
    dinners,
  };
}

export function allocateChoreSlots(
  rows: ChoreScoreRow[],
  target: number,
  kind: ChorePlanKind,
  days = 7,
): { selected: AllocatedSlot[]; shortage: number } {
  const templates = new Map<string, ChoreScoreRow[]>();
  rows.forEach((row) => {
    let key = row.shift;
    if (kind === 'dinner') {
      key = `${row.day ?? 0}|${row.timePeriod ?? ''}|${row.shift}`;
    } else if (kind === 'event') {
      key = `${row.periodOrder ?? 0}|${row.timePeriod ?? ''}|${row.shift}`;
    }
    const group = templates.get(key) ?? [];
    group.push(row);
    templates.set(key, group);
  });

  const groups: AllocationGroup[] = [];
  const addGroup = (
    templateKey: string,
    templateRows: ChoreScoreRow[],
    day: number,
  ) => {
    const groupKey = kind === 'dinner' ? templateKey : `${day}|${templateKey}`;
    groups.push({
      day,
      sourceOrder: templateRows[0]?.sourceOrder ?? 0,
      selectedCount: 0,
      slots: templateRows.map((row, slotOrder) => ({
        ...row,
        day,
        slotOrder,
        groupKey,
      })),
    });
  };

  if (kind === 'dinner') {
    templates.forEach((templateRows, templateKey) => {
      addGroup(templateKey, templateRows, templateRows[0]?.day ?? 0);
    });
  } else {
    for (let day = 1; day <= days; day += 1) {
      templates.forEach((templateRows, templateKey) => {
        addGroup(templateKey, templateRows, day);
      });
    }
  }

  const selected: AllocatedSlot[] = [];
  if (kind === 'chore' || kind === 'dinner') {
    groups.forEach((group, groupIndex) => {
      if (group.slots[0] && selected.length < target) {
        selected.push(group.slots[0]);
        groups[groupIndex].selectedCount = 1;
      }
    });
  }

  while (selected.length < target) {
    const candidates = groups
      .filter((group) => group.slots[group.selectedCount])
      .sort((first, second) => {
        const scoreDifference =
          second.slots[second.selectedCount].score -
          first.slots[first.selectedCount].score;
        if (scoreDifference) {
          return scoreDifference;
        }
        if (first.selectedCount !== second.selectedCount) {
          return first.selectedCount - second.selectedCount;
        }
        if (first.day !== second.day) {
          return first.day - second.day;
        }
        return first.sourceOrder - second.sourceOrder;
      });

    const group = candidates[0];
    if (!group) {
      break;
    }
    selected.push(group.slots[group.selectedCount]);
    group.selectedCount += 1;
  }

  return { selected, shortage: Math.max(0, target - selected.length) };
}

interface ParsedClock {
  hour: number;
  minute: number;
  marker: 'AM' | 'PM';
}

function parseClock(value: string): ParsedClock | null {
  const match = value
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a|p|am|pm)$/i);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }
  return {
    hour,
    minute,
    marker: match[3].toLowerCase().startsWith('a') ? 'AM' : 'PM',
  };
}

function hour24(clock: ParsedClock): number {
  return (clock.hour % 12) + (clock.marker === 'PM' ? 12 : 0);
}

function shiftTimes(
  year: number,
  day: number,
  kind: ChorePlanKind,
  timePeriod: string,
): { startTime: string; endTime: string } {
  const gatesOpen = DateTime.fromJSDate(getBurnDates(year).gatesOpen).setZone(
    BM_TIMEZONE,
  );
  const baseDay = gatesOpen.plus({ days: day - 1 });
  const rangeMatch = timePeriod.trim().match(/^(.+?)\s*-\s*(.+)$/);

  if (rangeMatch) {
    const startClock = parseClock(rangeMatch[1]);
    const endClock = parseClock(rangeMatch[2]);
    if (!startClock || !endClock) {
      throw new Error(`Could not understand the time period “${timePeriod}”.`);
    }
    const afterMidnightOffset =
      kind === 'event' && startClock.marker === 'AM' && hour24(startClock) < 8
        ? 1
        : 0;
    const start = baseDay.plus({ days: afterMidnightOffset }).set({
      hour: hour24(startClock),
      minute: startClock.minute,
      second: 0,
      millisecond: 0,
    });
    let end = baseDay.plus({ days: afterMidnightOffset }).set({
      hour: hour24(endClock),
      minute: endClock.minute,
      second: 0,
      millisecond: 0,
    });
    if (end <= start) {
      end = end.plus({ days: 1 });
    }
    return {
      startTime: start.toUTC().toISO() ?? '',
      endTime: end.toUTC().toISO() ?? '',
    };
  }

  const clock = parseClock(timePeriod);
  if (!clock) {
    throw new Error(`Could not understand the time “${timePeriod}”.`);
  }
  const start = baseDay.set({
    hour: hour24(clock),
    minute: clock.minute,
    second: 0,
    millisecond: 0,
  });
  return {
    startTime: start.toUTC().toISO() ?? '',
    endTime: start.plus({ hours: 1 }).toUTC().toISO() ?? '',
  };
}

function buildShiftPreviews(
  slots: AllocatedSlot[],
  kind: ChorePlanKind,
  year: number,
): ChorePlanShiftPreview[] {
  const grouped = new Map<string, AllocatedSlot[]>();
  slots.forEach((slot) => {
    const key = `${kind}|${slot.groupKey}`;
    const group = grouped.get(key) ?? [];
    group.push(slot);
    grouped.set(key, group);
  });

  return [...grouped.entries()].map(([key, group]) => {
    const first = group[0];
    const timePeriod = first.timePeriod ?? '';
    if (!timePeriod) {
      throw new Error(`“${first.shift}” needs a Time or Time Period value.`);
    }
    const times = shiftTimes(year, first.day, kind, timePeriod);
    const start = DateTime.fromISO(times.startTime).setZone(BM_TIMEZONE);
    return {
      key,
      scheduleKey: `${kind}|${first.shift}`,
      kind,
      scheduleName: first.shift,
      day: first.day,
      dayLabel: start.toFormat('cccc, LLL d'),
      timePeriod,
      periodOrder: first.periodOrder ?? 0,
      ...times,
      requiredParticipants: group.length,
      totalScore: group.reduce((total, slot) => total + slot.score, 0),
      positions: group.map((slot) => slot.position),
      slots: group.map((slot) => ({
        position: slot.position,
        score: slot.score,
      })),
    };
  });
}

export function buildChorePlan(input: ChorePlanInput): ChorePlanPreview {
  const choreTarget = input.camperCount * input.requirements.chore;
  const eventTarget = input.camperCount * input.requirements.event;
  const dinnerTarget = input.camperCount * input.requirements.dinner;
  const chores = allocateChoreSlots(input.chores, choreTarget, 'chore');
  const events = allocateChoreSlots(input.events, eventTarget, 'event');
  const dinners = allocateChoreSlots(input.dinners, dinnerTarget, 'dinner');

  const shifts = [
    ...buildShiftPreviews(chores.selected, 'chore', input.year),
    ...buildShiftPreviews(events.selected, 'event', input.year),
    ...buildShiftPreviews(dinners.selected, 'dinner', input.year),
  ].sort(
    (first, second) =>
      first.startTime.localeCompare(second.startTime) ||
      first.scheduleName.localeCompare(second.scheduleName),
  );

  return {
    rosterID: input.rosterID,
    year: input.year,
    camperCount: input.camperCount,
    sheetUrl: input.sheetUrl,
    sheetTitle: input.sheetTitle,
    requirements: input.requirements,
    categories: {
      chore: {
        target: choreTarget,
        selected: chores.selected.length,
        shortage: chores.shortage,
      },
      event: {
        target: eventTarget,
        selected: events.selected.length,
        shortage: events.shortage,
      },
      dinner: {
        target: dinnerTarget,
        selected: dinners.selected.length,
        shortage: dinners.shortage,
      },
    },
    shifts,
    existingPlan: null,
  };
}
