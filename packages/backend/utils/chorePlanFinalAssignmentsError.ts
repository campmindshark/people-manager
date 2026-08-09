export default class ChorePlanFinalAssignmentsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanFinalAssignmentsError';
    this.status = status;
  }
}
