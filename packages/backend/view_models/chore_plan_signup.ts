export interface ChorePlanSignupRequest {
  shiftID: number;
}

export interface ChorePlanSwitchRequest {
  fromShiftID: number;
  toShiftID: number;
}

export interface ChorePlanSignupMutationResponse {
  changed: boolean;
  assignedShiftIDs: number[];
}
