import { ChorePlanRequirements } from './chore_plan';

export type ChorePlanAuditAction =
  | 'plan_created'
  | 'plan_updated'
  | 'signups_opened'
  | 'signups_closed'
  | 'shift_participant_assigned'
  | 'shift_participants_reassigned'
  | 'shift_participant_unassigned'
  | 'participant_requirements_updated'
  | 'participant_requirements_reset';

export interface ChorePlanAuditActor {
  id: number | null;
  name: string;
}

export interface ChorePlanAuditShiftDetails {
  id: number;
  scheduleName: string;
  startTime: string;
}

export interface ChorePlanAuditReassignmentDetails {
  userID: number;
  userName: string;
  sourceShift: ChorePlanAuditShiftDetails;
  destinationShift: ChorePlanAuditShiftDetails;
}

export interface ChorePlanAuditUnassignmentDetails {
  userID: number;
  userName: string;
  sourceShift: ChorePlanAuditShiftDetails;
}

export interface ChorePlanAuditAssignmentDetails {
  userID: number;
  userName: string;
  destinationShift: ChorePlanAuditShiftDetails;
}

export interface ChorePlanAuditDetails {
  camperCount?: number;
  previousCamperCount?: number;
  slotCount?: number;
  addedSlots?: number;
  createdSchedules?: number;
  createdShifts?: number;
  sheetTitle?: string;
  previousSheetTitle?: string;
  requirements?: ChorePlanRequirements;
  previousRequirements?: ChorePlanRequirements;
  forced?: boolean;
  assignment?: ChorePlanAuditAssignmentDetails;
  reassignments?: ChorePlanAuditReassignmentDetails[];
  unassignment?: ChorePlanAuditUnassignmentDetails;
  participantUserID?: number;
  participantName?: string;
  reason?: string;
  previousReason?: string;
}

export default interface ChorePlanAuditEntry {
  id: number;
  chorePlanID: number;
  actor: ChorePlanAuditActor;
  action: ChorePlanAuditAction;
  details: ChorePlanAuditDetails;
  createdAt: string;
}
