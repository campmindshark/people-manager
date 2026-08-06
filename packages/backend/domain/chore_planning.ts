export const CHORE_PLAN_KINDS = ['chore', 'event', 'dinner'] as const;
export type ChorePlanKind = (typeof CHORE_PLAN_KINDS)[number];

export const CHORE_PLAN_STATUSES = ['draft', 'open', 'closed'] as const;
export type ChorePlanStatus = (typeof CHORE_PLAN_STATUSES)[number];

export type ChoreCatalogDayMode = 'template' | 'explicit';

export interface ChoreCatalogDefinition {
  stableKey: string;
  kind: ChorePlanKind;
  shiftLabel: string;
  positionLabel: string;
  dayMode: ChoreCatalogDayMode;
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
  sourceOrder: number;
}

export interface ChoreCatalogEntry extends ChoreCatalogDefinition {
  score: string;
}

export interface ChoreCatalogState {
  id: 1;
  revision: string;
  updatedAt: Date;
}
