export default class ChorePlanReadinessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanReadinessError';
    this.status = status;
  }
}
