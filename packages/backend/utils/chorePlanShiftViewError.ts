export default class ChorePlanShiftViewError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanShiftViewError';
    this.status = status;
  }
}
