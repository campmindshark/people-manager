export type ChorePlanSignupRejectionReason =
  | 'invalid_request'
  | 'user_not_found'
  | 'roster_not_found'
  | 'plan_not_found'
  | 'plan_not_open'
  | 'not_roster_member'
  | 'shift_not_found'
  | 'attendance_window'
  | 'overlap'
  | 'category_requirement'
  | 'capacity'
  | 'source_assignment_missing'
  | 'destination_assignment_exists';

export default class ChorePlanSignupError extends Error {
  status: number;

  readonly reason: ChorePlanSignupRejectionReason;

  constructor(
    message: string,
    status: number,
    reason: ChorePlanSignupRejectionReason = 'invalid_request',
  ) {
    super(message);
    this.name = 'ChorePlanSignupError';
    this.status = status;
    this.reason = reason;
  }
}
