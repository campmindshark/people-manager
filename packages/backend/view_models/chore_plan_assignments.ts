import { ChoreCatalogKind } from './chore_catalog';
import { ChorePlanRequirements } from './chore_plan_preview';

export type ChorePlanAdminAssignmentMutation =
  | {
      operation: 'assign';
      userID: number;
      shiftID: number;
    }
  | {
      operation: 'unassign';
      userID: number;
      shiftID: number;
    }
  | {
      operation: 'move';
      userID: number;
      fromShiftID: number;
      toShiftID: number;
    }
  | {
      operation: 'swap';
      firstUserID: number;
      firstShiftID: number;
      secondUserID: number;
      secondShiftID: number;
    };

export interface ChorePlanForceAssignmentRequest {
  mutation: ChorePlanAdminAssignmentMutation;
  reason: string;
}

export interface ChorePlanAdminAssignmentPlan {
  id: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  requirements: ChorePlanRequirements;
}

export interface ChorePlanAdminAssignmentParticipant {
  userID: number;
  firstName: string;
  lastName: string;
  playaName: string;
  estimatedArrivalDate: string;
  estimatedDepartureDate: string;
  requirements: ChorePlanRequirements;
  assignedShiftIDs: number[];
}

export interface ChorePlanAdminAssignmentShift {
  id: number;
  stableKey: string;
  kind: ChoreCatalogKind;
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  timePeriodLabel: string;
  periodOrder: number | null;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  assignedUserIDs: number[];
}

export interface ChorePlanAdminAssignmentViewResponse {
  rosterID: number;
  plan: ChorePlanAdminAssignmentPlan | null;
  mutationsAllowed: boolean;
  participants: ChorePlanAdminAssignmentParticipant[];
  shifts: ChorePlanAdminAssignmentShift[];
}

export interface ChorePlanAdminAssignmentMutationResponse {
  changed: boolean;
  forced: boolean;
  bypassedRules: string[];
}
