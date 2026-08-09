import { ChorePlanKind, ChorePlanStatus } from '../domain/chore_planning';
import { ChorePlanRequirements } from './chore_plan_preview';

export interface ChorePlanReadinessCategory {
  kind: ChorePlanKind;
  completeParticipants: number;
  incompleteParticipants: number;
  assignedShifts: number;
  requiredShifts: number;
}

export interface ChorePlanReadinessShift {
  shiftID: number;
  scheduleName: string;
  startTime: string;
  endTime: string;
  requiredParticipants: number;
  assignedParticipants: number;
  status: 'underfilled' | 'full' | 'overfilled';
}

export interface ChorePlanReadinessIncompleteParticipant {
  userID: number;
  name: string;
  missing: Partial<ChorePlanRequirements>;
}

export interface ChorePlanReadinessFeasibilityIssue {
  userID: number;
  name: string;
  kind: ChorePlanKind;
  reason:
    | 'missing_attendance'
    | 'no_generated_shifts'
    | 'outside_attendance'
    | 'assignment_conflicts'
    | 'shifts_full';
  message: string;
}

export type ChorePlanParticipantDataIssue =
  'public_profile' | 'private_profile' | 'attendance_window';

export interface ChorePlanReadinessParticipantDataIssue {
  userID: number;
  name: string;
  missing: ChorePlanParticipantDataIssue[];
}

export interface ChorePlanReadinessRequirementException {
  userID: number;
  name: string;
  type: 'exemption' | 'override';
  requirements: ChorePlanRequirements;
  reason: string;
}

export interface ChorePlanReadinessResponse {
  planID: number;
  rosterID: number;
  status: ChorePlanStatus;
  plannerHeadcount: number;
  actualRosterCount: number;
  headcountDifference: number;
  categories: Record<ChorePlanKind, ChorePlanReadinessCategory>;
  underfilledShifts: ChorePlanReadinessShift[];
  fullShifts: ChorePlanReadinessShift[];
  overfilledShifts: ChorePlanReadinessShift[];
  incompleteParticipants: ChorePlanReadinessIncompleteParticipant[];
  feasibilityIssues: ChorePlanReadinessFeasibilityIssue[];
  participantDataIssues: ChorePlanReadinessParticipantDataIssue[];
  requirementExceptions: ChorePlanReadinessRequirementException[];
  generatedAt: string;
}
