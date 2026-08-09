export default class ChorePlanAssignmentError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanAssignmentError';
    this.status = status;
  }
}
