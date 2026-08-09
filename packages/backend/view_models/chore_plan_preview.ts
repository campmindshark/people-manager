import { ChoreCatalogDefinitionView, ChoreCatalogKind } from './chore_catalog';

export type ChorePlanRequirements = Record<ChoreCatalogKind, number>;

export interface ChorePlanDisabledAssignment {
  shiftKey: string;
  definitionKey: string;
}

export interface ChorePlanDisabledSlotPreview extends ChorePlanDisabledAssignment {
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
  positionLabel: string;
  score: number;
}

export interface ChorePlanPreviewRequest {
  rosterID: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
  disabledAssignments?: ChorePlanDisabledAssignment[];
}

export interface ChorePlanApplyRequest extends ChorePlanPreviewRequest {
  expectedCatalogRevision: string;
  expectedDraftRevision: string | null;
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
  disabledAssignments: ChorePlanDisabledAssignment[];
  disabledSlots: ChorePlanDisabledSlotPreview[];
  disableableAssignments: ChorePlanDisabledAssignment[];
  reenableableAssignments: ChorePlanDisabledAssignment[];
  categories: Record<ChoreCatalogKind, ChorePlanPreviewCategory>;
  shifts: ChorePlanShiftPreview[];
}

export interface ChorePlanDraftSummary {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  draftRevision: string;
  catalogRevision: string;
  planningYear: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
  disabledAssignments: ChorePlanDisabledAssignment[];
  scheduleCount: number;
  shiftCount: number;
  slotCount: number;
  updatedAt: string;
}

export interface ChorePlanApplyResponse {
  changed: boolean;
  replaced: boolean;
  draft: ChorePlanDraftSummary;
  preview: ChorePlanPreview;
}

export interface ChorePlanDraftResponse {
  draft: ChorePlanDraftSummary | null;
}

export interface ChorePlanPreviewBuildInput extends ChorePlanPreviewRequest {
  year: number;
  catalogRevision: string;
  definitions: ChoreCatalogDefinitionView[];
}
