import { ChoreCatalogKind } from './chore_catalog';

export interface ChorePlanShiftViewPlan {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  openedAt: string | null;
  closedAt: string | null;
}

export interface ChorePlanShiftViewSlot {
  definitionKey: string;
  positionLabel: string;
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
  slots: ChorePlanShiftViewSlot[];
}

export interface ChorePlanShiftViewResponse {
  rosterID: number;
  plan: ChorePlanShiftViewPlan | null;
  selfServiceMutationsAllowed: boolean;
  shifts: ChorePlanShiftViewItem[];
}
