import { DateTime } from 'luxon';
import {
  ChoreCatalogDefinitionView,
  ChoreCatalogKind,
} from '../view_models/chore_catalog';
import { CHORE_CATALOG_V1 } from '../migrations/data/chore_catalog_v1';
import {
  ChorePlanPreview,
  ChorePlanPreviewBuildInput,
  ChorePlanShiftPreview,
} from '../view_models/chore_plan_preview';
import { BM_TIMEZONE, getBurnDates } from './burnDates';
import ChorePlanPreviewError from './chorePlanPreviewError';
import { parseChorePlanPreviewRequest } from './chorePlanPreviewInput';

const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];
const KIND_ORDER = new Map(KINDS.map((kind, index) => [kind, index]));
const EXPECTED_DEFINITION_COUNTS: Record<ChoreCatalogKind, number> = {
  chore: 32,
  event: 240,
  dinner: 54,
};
const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
const REVISION_PATTERN = /^[1-9][0-9]*$/;
const STABLE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIXED_CATALOG_FIELD_SET = {
  kind: true,
  shiftLabel: true,
  positionLabel: true,
  dayMode: true,
  dayNumber: true,
  dayLabel: true,
  timePeriodLabel: true,
  periodOrder: true,
  startLocalTime: true,
  endLocalTime: true,
  endDayOffset: true,
  sourceOrder: true,
} satisfies Record<
  Exclude<keyof ChoreCatalogDefinitionView, 'score' | 'stableKey'>,
  true
>;
const FIXED_CATALOG_FIELDS = Object.keys(FIXED_CATALOG_FIELD_SET) as Array<
  keyof typeof FIXED_CATALOG_FIELD_SET
>;
const FIXED_CATALOG_BY_KEY = new Map(
  CHORE_CATALOG_V1.map((definition) => [definition.stableKey, definition]),
);

interface PlanningDefinition extends ChoreCatalogDefinitionView {
  scoreCents: number;
}

interface DefinitionGroup {
  anchorKey: string;
  kind: ChoreCatalogKind;
  shiftLabel: string;
  dayNumber: number | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
  sourceOrder: number;
  definitions: PlanningDefinition[];
}

interface AllocationGroup extends DefinitionGroup {
  stableKey: string;
  scheduleKey: string;
  calendarDay: number;
  displayCalendarDay: number;
  displayDayNumber: number;
}

interface SelectedSlot {
  group: AllocationGroup;
  definition: PlanningDefinition;
}

function invalidCatalog(message: string): never {
  throw new ChorePlanPreviewError(`Invalid chore catalog: ${message}`, 500);
}

function scoreCents(score: number): number {
  const cents = Math.round(score * 100);
  if (
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    Math.abs(score - cents / 100) > 1e-9
  ) {
    invalidCatalog('a score is outside 0 through 100 or exceeds two decimals.');
  }
  return cents;
}

function clockMinutes(value: string): number {
  if (!TIME_PATTERN.test(value)) {
    invalidCatalog(`the local time ${value} is invalid.`);
  }
  const [hour, minute, second] = value.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
}

function validateDefinition(
  definition: ChoreCatalogDefinitionView,
): PlanningDefinition {
  if (
    !STABLE_KEY_PATTERN.test(definition.stableKey) ||
    !definition.shiftLabel.trim() ||
    !definition.positionLabel.trim() ||
    !definition.timePeriodLabel.trim() ||
    !Number.isInteger(definition.sourceOrder) ||
    definition.sourceOrder < 0 ||
    ![0, 1].includes(definition.endDayOffset)
  ) {
    invalidCatalog(`definition ${definition.stableKey} has invalid metadata.`);
  }
  const start = clockMinutes(definition.startLocalTime);
  const end =
    clockMinutes(definition.endLocalTime) +
    definition.endDayOffset * 24 * 60 * 60;
  if (end <= start) {
    invalidCatalog(
      `definition ${definition.stableKey} has an invalid interval.`,
    );
  }

  if (definition.kind === 'chore') {
    if (
      definition.dayMode !== 'template' ||
      definition.dayNumber !== null ||
      definition.dayLabel !== null ||
      definition.periodOrder !== null
    ) {
      invalidCatalog(
        `definition ${definition.stableKey} has invalid chore metadata.`,
      );
    }
  } else {
    const maximumDayNumber = definition.kind === 'event' ? 8 : 7;
    if (
      definition.dayMode !== 'explicit' ||
      !Number.isInteger(definition.dayNumber) ||
      definition.dayNumber === null ||
      definition.dayNumber < 1 ||
      definition.dayNumber > maximumDayNumber ||
      definition.dayLabel !== DAY_LABELS[(definition.dayNumber - 1) % 7]
    ) {
      invalidCatalog(
        `definition ${definition.stableKey} has invalid day metadata.`,
      );
    }
    if (
      (definition.kind === 'event' &&
        (!Number.isInteger(definition.periodOrder) ||
          definition.periodOrder === null ||
          definition.periodOrder < 1)) ||
      (definition.kind === 'dinner' && definition.periodOrder !== null)
    ) {
      invalidCatalog(
        `definition ${definition.stableKey} has invalid period metadata.`,
      );
    }
  }

  return { ...definition, scoreCents: scoreCents(definition.score) };
}

function validateFixedCatalog(definitions: PlanningDefinition[]): void {
  if (definitions.length !== CHORE_CATALOG_V1.length) {
    invalidCatalog('the definition count does not match the fixed catalog.');
  }

  definitions.forEach((definition) => {
    const expectedDefinition = FIXED_CATALOG_BY_KEY.get(definition.stableKey);
    if (!expectedDefinition) {
      invalidCatalog(
        `definition ${definition.stableKey} is not in the fixed catalog.`,
      );
    }
    FIXED_CATALOG_FIELDS.forEach((field) => {
      if (definition[field] !== expectedDefinition[field]) {
        invalidCatalog(
          `definition ${definition.stableKey} does not match the fixed catalog field ${field}.`,
        );
      }
    });
  });
}

function definitionGroupKey(definition: PlanningDefinition): string {
  if (definition.kind === 'chore') {
    return definition.shiftLabel;
  }
  if (definition.kind === 'event') {
    return `${definition.periodOrder}|${definition.shiftLabel}`;
  }
  return `${definition.dayNumber}|${definition.shiftLabel}`;
}

function groupDefinitions(
  definitions: PlanningDefinition[],
): DefinitionGroup[] {
  const groups = new Map<string, PlanningDefinition[]>();
  definitions.forEach((definition) => {
    const key = `${definition.kind}|${definitionGroupKey(definition)}`;
    groups.set(key, [...(groups.get(key) ?? []), definition]);
  });

  return [...groups.values()].map((entries) => {
    const sorted = [...entries].sort(
      (first, second) =>
        first.sourceOrder - second.sourceOrder ||
        first.stableKey.localeCompare(second.stableKey),
    );
    const first = sorted[0];
    const positions = new Set<string>();
    sorted.forEach((definition) => {
      if (
        definition.shiftLabel !== first.shiftLabel ||
        definition.dayNumber !== first.dayNumber ||
        definition.timePeriodLabel !== first.timePeriodLabel ||
        definition.periodOrder !== first.periodOrder ||
        definition.startLocalTime !== first.startLocalTime ||
        definition.endLocalTime !== first.endLocalTime ||
        definition.endDayOffset !== first.endDayOffset ||
        positions.has(definition.positionLabel)
      ) {
        invalidCatalog(`definition group ${first.stableKey} is inconsistent.`);
      }
      positions.add(definition.positionLabel);
    });
    return {
      anchorKey: first.stableKey,
      kind: first.kind,
      shiftLabel: first.shiftLabel,
      dayNumber: first.dayNumber,
      timePeriodLabel: first.timePeriodLabel,
      periodOrder: first.periodOrder,
      startLocalTime: first.startLocalTime,
      endLocalTime: first.endLocalTime,
      endDayOffset: first.endDayOffset,
      sourceOrder: first.sourceOrder,
      definitions: sorted,
    };
  });
}

function eventCalendarDays(
  definitions: PlanningDefinition[],
): Map<number, { calendarDay: number; displayCalendarDay: number }> {
  const periods = new Map<
    number,
    {
      dayNumber: number;
      timePeriodLabel: string;
      startLocalTime: string;
      endLocalTime: string;
      endDayOffset: 0 | 1;
    }
  >();
  definitions
    .filter(({ kind }) => kind === 'event')
    .forEach((definition) => {
      const periodOrder = definition.periodOrder ?? 0;
      const dayNumber = definition.dayNumber ?? 0;
      const existing = periods.get(periodOrder);
      if (
        existing &&
        (existing.dayNumber !== dayNumber ||
          existing.timePeriodLabel !== definition.timePeriodLabel ||
          existing.startLocalTime !== definition.startLocalTime ||
          existing.endLocalTime !== definition.endLocalTime ||
          existing.endDayOffset !== definition.endDayOffset)
      ) {
        invalidCatalog(`event period ${periodOrder} is inconsistent.`);
      }
      periods.set(periodOrder, {
        dayNumber,
        timePeriodLabel: definition.timePeriodLabel,
        startLocalTime: definition.startLocalTime,
        endLocalTime: definition.endLocalTime,
        endDayOffset: definition.endDayOffset,
      });
    });

  const result = new Map<
    number,
    { calendarDay: number; displayCalendarDay: number }
  >();
  let weekOffset = 0;
  let previousDay: number | null = null;
  [...periods.entries()]
    .sort(([first], [second]) => first - second)
    .forEach(([periodOrder, period], index) => {
      if (periodOrder !== index + 1) {
        invalidCatalog('event period order must be contiguous from 1.');
      }
      if (previousDay !== null && period.dayNumber < previousDay) {
        weekOffset += 7;
      }
      if (weekOffset > 7) {
        invalidCatalog('event periods wrap across more than one week.');
      }
      const calendarDay = period.dayNumber + weekOffset;
      const displayCalendarDay =
        clockMinutes(period.startLocalTime) < 6 * 60 * 60
          ? calendarDay - 1
          : calendarDay;
      if (
        calendarDay < 1 ||
        calendarDay > 8 ||
        displayCalendarDay < 1 ||
        displayCalendarDay > 7
      ) {
        invalidCatalog('event calendar days fall outside the planning week.');
      }
      result.set(periodOrder, {
        calendarDay,
        displayCalendarDay,
      });
      previousDay = period.dayNumber;
    });
  return result;
}

function allocationGroups(
  definitions: PlanningDefinition[],
): AllocationGroup[] {
  const groups = groupDefinitions(definitions).sort(
    (first, second) =>
      (KIND_ORDER.get(first.kind) ?? 99) -
        (KIND_ORDER.get(second.kind) ?? 99) ||
      first.sourceOrder - second.sourceOrder ||
      first.anchorKey.localeCompare(second.anchorKey),
  );
  const eventDays = eventCalendarDays(definitions);
  const result: AllocationGroup[] = [];

  const addOccurrence = (
    group: DefinitionGroup,
    calendarDay: number,
    displayCalendarDay: number,
  ) => {
    result.push({
      ...group,
      stableKey: `${group.kind}|${calendarDay}|${group.anchorKey}`,
      scheduleKey: `${group.kind}|${group.shiftLabel}`,
      calendarDay,
      displayCalendarDay,
      displayDayNumber: ((displayCalendarDay - 1) % 7) + 1,
    });
  };

  const choreGroups = groups.filter(({ kind }) => kind === 'chore');
  for (let day = 1; day <= 7; day += 1) {
    choreGroups.forEach((group) => addOccurrence(group, day, day));
  }
  groups
    .filter(({ kind }) => kind === 'event')
    .forEach((group) => {
      const eventDay = eventDays.get(group.periodOrder ?? 0);
      if (!eventDay) {
        invalidCatalog(`event group ${group.anchorKey} has no calendar day.`);
      }
      addOccurrence(group, eventDay.calendarDay, eventDay.displayCalendarDay);
    });
  groups
    .filter(({ kind }) => kind === 'dinner')
    .forEach((group) => {
      const day = group.dayNumber ?? 0;
      addOccurrence(group, day, day);
    });
  return result;
}

function selectSlots(
  allGroups: AllocationGroup[],
  kind: ChoreCatalogKind,
  target: number,
): { selected: SelectedSlot[]; shortage: number } {
  const groups = allGroups.filter((group) => group.kind === kind);
  const selected: SelectedSlot[] = [];
  const selectedCounts = new Map<string, number>();

  if (kind === 'chore' || kind === 'dinner') {
    groups.forEach((group) => {
      if (selected.length < target && group.definitions[0]) {
        selected.push({ group, definition: group.definitions[0] });
        selectedCounts.set(group.stableKey, 1);
      }
    });
  }

  while (selected.length < target) {
    const candidates = groups
      .filter(
        (group) => group.definitions[selectedCounts.get(group.stableKey) ?? 0],
      )
      .sort((first, second) => {
        const firstCount = selectedCounts.get(first.stableKey) ?? 0;
        const secondCount = selectedCounts.get(second.stableKey) ?? 0;
        const scoreDifference =
          second.definitions[secondCount].scoreCents -
          first.definitions[firstCount].scoreCents;
        return (
          scoreDifference ||
          firstCount - secondCount ||
          first.displayCalendarDay - second.displayCalendarDay ||
          first.sourceOrder - second.sourceOrder ||
          first.stableKey.localeCompare(second.stableKey)
        );
      });
    const group = candidates[0];
    if (!group) {
      break;
    }
    const selectedCount = selectedCounts.get(group.stableKey) ?? 0;
    selected.push({
      group,
      definition: group.definitions[selectedCount],
    });
    selectedCounts.set(group.stableKey, selectedCount + 1);
  }

  return { selected, shortage: Math.max(0, target - selected.length) };
}

function localDateTime(
  gatesOpen: DateTime,
  calendarDay: number,
  value: string,
  extraDays = 0,
): DateTime {
  const [hour, minute, second] = value.split(':').map(Number);
  return gatesOpen.plus({ days: calendarDay - 1 + extraDays }).set({
    hour,
    minute,
    second,
    millisecond: 0,
  });
}

function buildShift(
  group: AllocationGroup,
  definitions: PlanningDefinition[],
  gatesOpen: DateTime,
): ChorePlanShiftPreview {
  const start = localDateTime(
    gatesOpen,
    group.calendarDay,
    group.startLocalTime,
  );
  const end = localDateTime(
    gatesOpen,
    group.calendarDay,
    group.endLocalTime,
    group.endDayOffset,
  );
  const displayDay = gatesOpen.plus({ days: group.displayCalendarDay - 1 });
  return {
    stableKey: group.stableKey,
    scheduleKey: group.scheduleKey,
    kind: group.kind,
    scheduleName: group.shiftLabel,
    displayDayNumber: group.displayDayNumber,
    displayDayLabel: displayDay.toFormat('cccc, LLL d'),
    calendarDay: group.calendarDay,
    timePeriodLabel: group.timePeriodLabel,
    periodOrder: group.periodOrder,
    startTime: start.toUTC().toISO() ?? '',
    endTime: end.toUTC().toISO() ?? '',
    requiredParticipants: definitions.length,
    totalScore:
      definitions.reduce(
        (total, definition) => total + definition.scoreCents,
        0,
      ) / 100,
    slots: definitions.map((definition) => ({
      definitionKey: definition.stableKey,
      positionLabel: definition.positionLabel,
      score: definition.scoreCents / 100,
    })),
  };
}

export default function buildChorePlanPreview(
  input: ChorePlanPreviewBuildInput,
): ChorePlanPreview {
  const request = parseChorePlanPreviewRequest({
    rosterID: input.rosterID,
    camperCount: input.camperCount,
    requirements: input.requirements,
  });
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2200) {
    throw new ChorePlanPreviewError('Roster year is invalid.', 500);
  }
  if (!REVISION_PATTERN.test(input.catalogRevision)) {
    invalidCatalog('the revision is invalid.');
  }

  const definitions = input.definitions
    .map(validateDefinition)
    .sort(
      (first, second) =>
        (KIND_ORDER.get(first.kind) ?? 99) -
          (KIND_ORDER.get(second.kind) ?? 99) ||
        first.sourceOrder - second.sourceOrder ||
        first.stableKey.localeCompare(second.stableKey),
    );
  const keys = new Set<string>();
  const orders = new Set<string>();
  definitions.forEach((definition) => {
    const orderKey = `${definition.kind}|${definition.sourceOrder}`;
    if (keys.has(definition.stableKey) || orders.has(orderKey)) {
      invalidCatalog('definition keys and source orders must be unique.');
    }
    keys.add(definition.stableKey);
    orders.add(orderKey);
  });
  validateFixedCatalog(definitions);
  KINDS.forEach((kind) => {
    const kindDefinitions = definitions.filter(
      (definition) => definition.kind === kind,
    );
    if (kindDefinitions.length !== EXPECTED_DEFINITION_COUNTS[kind]) {
      invalidCatalog(`the ${kind} definition count is unexpected.`);
    }
    kindDefinitions.forEach((definition, index) => {
      if (definition.sourceOrder !== index) {
        invalidCatalog(`the ${kind} source order must be contiguous from 0.`);
      }
    });
  });

  const groups = allocationGroups(definitions);
  const allocations = Object.fromEntries(
    KINDS.map((kind) => {
      const target = request.camperCount * request.requirements[kind];
      return [kind, { target, ...selectSlots(groups, kind, target) }];
    }),
  ) as Record<
    ChoreCatalogKind,
    { target: number; selected: SelectedSlot[]; shortage: number }
  >;
  const gatesOpen = DateTime.fromJSDate(
    getBurnDates(input.year).gatesOpen,
  ).setZone(BM_TIMEZONE);
  const selectedByGroup = new Map<
    string,
    { group: AllocationGroup; definitions: PlanningDefinition[] }
  >();
  KINDS.forEach((kind) => {
    allocations[kind].selected.forEach(({ group, definition }) => {
      const selected = selectedByGroup.get(group.stableKey) ?? {
        group,
        definitions: [],
      };
      selected.definitions.push(definition);
      selectedByGroup.set(group.stableKey, selected);
    });
  });
  const shifts = [...selectedByGroup.values()]
    .map(({ group, definitions: selectedDefinitions }) =>
      buildShift(group, selectedDefinitions, gatesOpen),
    )
    .sort(
      (first, second) =>
        first.startTime.localeCompare(second.startTime) ||
        first.scheduleName.localeCompare(second.scheduleName) ||
        first.stableKey.localeCompare(second.stableKey),
    );

  return {
    rosterID: request.rosterID,
    year: input.year,
    camperCount: request.camperCount,
    requirements: { ...request.requirements },
    catalogRevision: input.catalogRevision,
    categories: {
      chore: {
        target: allocations.chore.target,
        selected: allocations.chore.selected.length,
        shortage: allocations.chore.shortage,
      },
      event: {
        target: allocations.event.target,
        selected: allocations.event.selected.length,
        shortage: allocations.event.shortage,
      },
      dinner: {
        target: allocations.dinner.target,
        selected: allocations.dinner.selected.length,
        shortage: allocations.dinner.shortage,
      },
    },
    shifts,
  };
}
