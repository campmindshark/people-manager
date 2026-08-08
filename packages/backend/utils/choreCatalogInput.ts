import { ChoreCatalogScoreUpdateRequest } from '../view_models/chore_catalog';
import ChoreCatalogError from './choreCatalogError';

const SCORE_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/;
const REVISION_PATTERN = /^[1-9][0-9]*$/;

export function isValidChoreCatalogScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    SCORE_PATTERN.test(String(value))
  );
}

export function parseChoreCatalogScoreUpdate(
  value: unknown,
): ChoreCatalogScoreUpdateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChoreCatalogError('Enter a score and expected revision.', 400);
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'expectedRevision' ||
    keys[1] !== 'score'
  ) {
    throw new ChoreCatalogError(
      'Only score and expectedRevision may be changed.',
      400,
    );
  }

  if (!isValidChoreCatalogScore(input.score)) {
    throw new ChoreCatalogError(
      'Score must be from 0 through 100 with at most two decimal places.',
      400,
    );
  }

  if (
    typeof input.expectedRevision !== 'string' ||
    !REVISION_PATTERN.test(input.expectedRevision)
  ) {
    throw new ChoreCatalogError('Expected revision is invalid.', 400);
  }

  return {
    score: input.score,
    expectedRevision: input.expectedRevision,
  };
}
