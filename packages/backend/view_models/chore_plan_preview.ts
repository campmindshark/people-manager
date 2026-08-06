import { ChoreCatalogDefinitionView, ChoreCatalogKind } from './chore_catalog';

export type ChorePlanRequirements = Record<ChoreCatalogKind, number>;

export interface ChorePlanPreviewRequest {
  rosterID: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
}

export interface ChorePlanPreviewCategory {
  target: number;
  selected: number;
  shortage: number;
}

export interface ChorePlanPreviewSlot {
  definitionKey: string;
  positionLabel: string;
  score: number;
}

export interface ChorePlanShiftPreview {
  stableKey: string;
  scheduleKey: string;
  kind: ChoreCatalogKind;
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  calendarDay: number;
  timePeriodLabel: string;
  periodOrder: number | null;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  totalScore: number;
  slots: ChorePlanPreviewSlot[];
}

export interface ChorePlanPreview {
  rosterID: number;
  year: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
  catalogRevision: string;
  categories: Record<ChoreCatalogKind, ChorePlanPreviewCategory>;
  shifts: ChorePlanShiftPreview[];
}

export interface ChorePlanPreviewBuildInput extends ChorePlanPreviewRequest {
  year: number;
  catalogRevision: string;
  definitions: ChoreCatalogDefinitionView[];
}
