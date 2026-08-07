export default class ChorePlanAssignmentError extends Error {
  readonly status: number;

  readonly conflictRules?: string[];

  constructor(message: string, status: number, conflictRules?: string[]) {
    super(message);
    this.name = 'ChorePlanAssignmentError';
    this.status = status;
    this.conflictRules = conflictRules;
  }
}
