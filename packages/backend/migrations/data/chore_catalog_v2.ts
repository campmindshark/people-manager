import {
  CHORE_CATALOG_V1,
  CHORE_CATALOG_V1_SOURCE,
  ChoreCatalogSeedRow,
} from './chore_catalog_v1';

const EXCLUDED_EVENT_TIME_PERIODS = new Set(['3a-6a']);

export const CHORE_CATALOG_V2_SOURCE = {
  ...CHORE_CATALOG_V1_SOURCE,
  eventSHA256:
    'fdfa5ddfc67b46f5aa1ee1e82c82396664bbb2c7f20f4e564b78d92d13668c2a',
  rawEventSHA256: CHORE_CATALOG_V1_SOURCE.eventSHA256,
  excludedEventTimePeriods: ['3a-6a'],
} as const;

const acceptedRows = CHORE_CATALOG_V1.filter(
  ({ kind, timePeriodLabel }) =>
    kind !== 'event' || !EXCLUDED_EVENT_TIME_PERIODS.has(timePeriodLabel),
);
const acceptedEventPeriodOrders = Array.from(
  new Set(
    acceptedRows
      .filter(({ kind }) => kind === 'event')
      .map(({ periodOrder }) => periodOrder)
      .filter((periodOrder): periodOrder is number => periodOrder !== null),
  ),
).sort((left, right) => left - right);
const remappedEventPeriodOrders = new Map(
  acceptedEventPeriodOrders.map((periodOrder, index) => [
    periodOrder,
    index + 1,
  ]),
);
let eventSourceOrder = 0;

export const CHORE_CATALOG_V2: ChoreCatalogSeedRow[] = acceptedRows.map(
  (row) => {
    if (row.kind !== 'event' || row.periodOrder === null) {
      return { ...row };
    }

    const periodOrder = remappedEventPeriodOrders.get(row.periodOrder);
    if (periodOrder === undefined) {
      throw new Error(`Could not remap event period ${row.periodOrder}.`);
    }

    const acceptedRow = {
      ...row,
      periodOrder,
      sourceOrder: eventSourceOrder,
    };
    eventSourceOrder += 1;
    return acceptedRow;
  },
);

const rowCounts = CHORE_CATALOG_V2.reduce<Record<string, number>>(
  (counts, { kind }) => ({ ...counts, [kind]: (counts[kind] ?? 0) + 1 }),
  {},
);
const stableKeys = new Set(CHORE_CATALOG_V2.map(({ stableKey }) => stableKey));

if (
  rowCounts.chore !== 32 ||
  rowCounts.event !== 216 ||
  rowCounts.dinner !== 54 ||
  stableKeys.size !== CHORE_CATALOG_V2.length
) {
  throw new Error('Chore catalog v2 failed its static integrity check.');
}
