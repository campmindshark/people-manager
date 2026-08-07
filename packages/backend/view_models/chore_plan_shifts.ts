import { ChoreCatalogKind } from './chore_catalog';
import { ChorePlanRequirements } from './chore_plan_preview';

export const CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES = {
  existingShiftConflict:
    'You already have another assignment during this time block.',
  outsideAttendanceWindow:
    'This shift is outside your roster attendance window.',
} as const;

export interface ChorePlanShiftViewPlan {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  requirements: ChorePlanRequirements;
  openedAt: string | null;
  closedAt: string | null;
}

export interface ChorePlanShiftViewSlot {
  definitionKey: string;
  positionLabel: string;
}

export interface ChorePlanShiftViewAssignment {
  displayName: string;
  currentUser: boolean;
}

export interface ChorePlanShiftViewConflict {
  shiftID: number;
  scheduleName: string;
  startTime: string;
  endTime: string;
}

export interface ChorePlanShiftViewItem {
  id: number;
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
  assignedParticipantCount: number;
  currentUserAssigned: boolean;
  signupRestrictionReason: string | null;
  signupConflictShiftIDs: number[];
  signupConflicts: ChorePlanShiftViewConflict[];
  assignments: ChorePlanShiftViewAssignment[];
  slots: ChorePlanShiftViewSlot[];
}

export interface ChorePlanShiftViewResponse {
  rosterID: number;
  plan: ChorePlanShiftViewPlan | null;
  selfServiceMutationsAllowed: boolean;
  shifts: ChorePlanShiftViewItem[];
}
