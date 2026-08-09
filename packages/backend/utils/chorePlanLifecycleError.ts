export default class ChorePlanLifecycleError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanLifecycleError';
    this.status = status;
  }
}
