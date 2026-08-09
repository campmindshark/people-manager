import ChorePlanLifecycleError from './chorePlanLifecycleError';

export const MAX_CHORE_PLAN_REOPEN_REASON_LENGTH = 500;

export function parseEmptyLifecycleRequest(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 0
  ) {
    throw new ChorePlanLifecycleError(
      'This lifecycle transition does not accept request details.',
      400,
    );
  }
}

export function parseChorePlanReopenRequest(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChorePlanLifecycleError('Enter a reopening reason.', 400);
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 1 || typeof input.reason !== 'string') {
    throw new ChorePlanLifecycleError(
      'A reopen request accepts only a reason.',
      400,
    );
  }

  const reason = input.reason.trim();
  if (
    reason.length === 0 ||
    reason.length > MAX_CHORE_PLAN_REOPEN_REASON_LENGTH
  ) {
    throw new ChorePlanLifecycleError(
      `Reopening reason must be from 1 through ${MAX_CHORE_PLAN_REOPEN_REASON_LENGTH} characters.`,
      400,
    );
  }
  return reason;
}
