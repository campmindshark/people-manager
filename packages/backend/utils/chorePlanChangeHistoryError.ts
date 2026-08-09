export default class ChorePlanChangeHistoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanChangeHistoryError';
    this.status = status;
  }
}
