export type ChorePlanKind = 'chore' | 'event' | 'dinner';

export type ChorePlanRequirements = Record<ChorePlanKind, number>;

export const DEFAULT_CHORE_PLAN_REQUIREMENTS: ChorePlanRequirements = {
  chore: 3,
  event: 3,
  dinner: 1,
};

export const MAX_CHORE_PLAN_REQUIREMENT = 20;

export const CHORE_PLAN_KINDS: ChorePlanKind[] = ['chore', 'event', 'dinner'];

export type ChorePlanStatus = 'draft' | 'open' | 'closed';

export interface ChorePlanActorSummary {
  id: number;
  name: string;
}

export interface ChoreScoreRow {
  shift: string;
  position: string;
  score: number;
  day?: number;
  dayLabel?: string;
  timePeriod?: string;
  periodOrder?: number;
  sourceOrder: number;
}

export interface ChorePlanCategorySummary {
  target: number;
  selected: number;
  shortage: number;
}

export interface ChorePlanPositionPreview {
  position: string;
  score: number;
}

export interface ChorePlanShiftPreview {
  key: string;
  scheduleKey: string;
  kind: ChorePlanKind;
  scheduleName: string;
  day: number;
  dayLabel: string;
  timePeriod: string;
  periodOrder: number;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  totalScore: number;
  positions: string[];
  slots: ChorePlanPositionPreview[];
}

export interface ChorePlanSummary {
  id: number;
  rosterID: number;
  camperCount: number;
  sheetUrl: string;
  sheetTitle: string;
  requirements: ChorePlanRequirements;
  scheduleCount: number;
  shiftCount: number;
  slotCount: number;
  status: ChorePlanStatus;
  openedAt: string | null;
  openedBy: ChorePlanActorSummary | null;
  closedAt: string | null;
  closedBy: ChorePlanActorSummary | null;
  updatedAt: string;
}

export interface ChorePlanParticipantRequirements {
  userID: number;
  requirements: ChorePlanRequirements;
  hasCustomRequirements: boolean;
  requirementExceptionReason: string | null;
}

export interface ChorePlanReadinessCategory {
  kind: ChorePlanKind;
  completeMembers: number;
  incompleteMembers: number;
  assignedSpots: number;
  requiredSpots: number;
}

export interface ChorePlanReadinessShift {
  shiftID: number;
  scheduleName: string;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  participantCount: number;
  status: 'underfilled' | 'full' | 'overfilled';
}

export interface ChorePlanReadinessIncompleteMember {
  userID: number;
  name: string;
  missing: Partial<ChorePlanRequirements>;
}

export interface ChorePlanReadinessNoChoice {
  userID: number;
  name: string;
  kind: ChorePlanKind;
  reason: string;
}

export interface ChorePlanReadinessRequirementException {
  userID: number;
  name: string;
  type: 'exemption' | 'override';
  requirements: ChorePlanRequirements;
  reason: string;
}

export interface ChorePlanReadiness {
  planID: number;
  rosterID: number;
  plannerHeadcount: number;
  actualRosterCount: number;
  headcountDifference: number;
  categories: Record<ChorePlanKind, ChorePlanReadinessCategory>;
  underfilledShifts: ChorePlanReadinessShift[];
  fullShifts: ChorePlanReadinessShift[];
  overfilledShifts: ChorePlanReadinessShift[];
  incompleteMembers: ChorePlanReadinessIncompleteMember[];
  noFeasibleChoices: ChorePlanReadinessNoChoice[];
  requirementExceptions: ChorePlanReadinessRequirementException[];
  generatedAt: string;
}

export default interface ChorePlanPreview {
  rosterID: number;
  year: number;
  camperCount: number;
  sheetUrl: string;
  sheetTitle: string;
  requirements: ChorePlanRequirements;
  categories: Record<ChorePlanKind, ChorePlanCategorySummary>;
  shifts: ChorePlanShiftPreview[];
  existingPlan: ChorePlanSummary | null;
}

export interface ChorePlanApplyResult {
  plan: ChorePlanSummary;
  addedSlots: number;
  createdSchedules: number;
  createdShifts: number;
}
