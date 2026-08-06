export default class ChorePlanPreviewError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChorePlanPreviewError';
    this.status = status;
  }
}
