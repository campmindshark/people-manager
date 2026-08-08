export default class ChoreCatalogError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChoreCatalogError';
    this.status = status;
  }
}
