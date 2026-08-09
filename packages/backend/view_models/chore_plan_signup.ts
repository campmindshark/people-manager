export const MAX_CHORE_PLAN_SIGNUPS_PER_REQUEST = 3;

export interface ChorePlanSignupRequest {
  shiftIDs: number[];
}

export interface ChorePlanSwitchRequest {
  fromShiftID: number;
  toShiftID: number;
}

export interface ChorePlanSignupMutationResponse {
  changed: boolean;
  assignedShiftIDs: number[];
}
