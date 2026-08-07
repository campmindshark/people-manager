import { ChorePlanKind } from '../domain/chore_planning';

export interface ChorePlanFinalAssignmentParticipant {
  displayName: string;
  currentUser: boolean;
}

export interface ChorePlanFinalAssignmentShift {
  id: number;
  stableKey: string;
  kind: ChorePlanKind;
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  calendarDay: number;
  timePeriodLabel: string;
  periodOrder: number | null;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  participants: ChorePlanFinalAssignmentParticipant[];
}

export interface ChorePlanFinalAssignmentCategory {
  kind: ChorePlanKind;
  shifts: ChorePlanFinalAssignmentShift[];
}

export interface ChorePlanFinalAssignmentsResponse {
  rosterID: number;
  planID: number;
  status: 'closed';
  planningYear: number;
  closedAt: string;
  assignmentCount: number;
  categories: ChorePlanFinalAssignmentCategory[];
}
