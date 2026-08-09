export default class ChorePlanRequirementError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanRequirementError';
    this.status = status;
  }
}
