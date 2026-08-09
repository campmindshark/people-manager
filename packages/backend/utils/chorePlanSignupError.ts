export default class ChorePlanSignupError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanSignupError';
    this.status = status;
  }
}
