import {
  ChorePlanRequirementOverrideClearRequest,
  ChorePlanRequirementOverrideRequest,
} from '../view_models/chore_plan_requirements';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';
import ChorePlanRequirementError from './chorePlanRequirementError';

export const MAX_CHORE_PLAN_REQUIREMENT_OVERRIDE_REASON_LENGTH = 500;

export function parseChorePlanRequirementParticipantID(value: unknown): number {
  const parsed =
    typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
      ? Number(value)
      : value;
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 1) {
    throw new ChorePlanRequirementError(
      'Choose a valid roster participant.',
      400,
    );
  }
  return Number(parsed);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function parseReason(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ChorePlanRequirementError(
      'Enter a reason for this requirement change.',
      400,
    );
  }
  const reason = value.trim();
  if (
    reason.length === 0 ||
    reason.length > MAX_CHORE_PLAN_REQUIREMENT_OVERRIDE_REASON_LENGTH
  ) {
    throw new ChorePlanRequirementError(
      `Requirement change reason must be from 1 through ${MAX_CHORE_PLAN_REQUIREMENT_OVERRIDE_REASON_LENGTH} characters.`,
      400,
    );
  }
  return reason;
}

function parseRequirements(value: unknown): ChorePlanRequirements {
  if (!isObject(value) || !hasExactKeys(value, ['chore', 'event', 'dinner'])) {
    throw new ChorePlanRequirementError(
      'Requirements must contain only chore, event, and dinner.',
      400,
    );
  }
  const requirements = {} as ChorePlanRequirements;
  (['chore', 'event', 'dinner'] as const).forEach((kind) => {
    const requirement = value[kind];
    if (
      !Number.isInteger(requirement) ||
      Number(requirement) < 0 ||
      Number(requirement) > 20
    ) {
      throw new ChorePlanRequirementError(
        `${kind[0].toUpperCase()}${kind.slice(
          1,
        )} requirements must be a whole number from 0 to 20.`,
        400,
      );
    }
    requirements[kind] = Number(requirement);
  });
  return requirements;
}

export function parseChorePlanRequirementOverrideRequest(
  value: unknown,
): ChorePlanRequirementOverrideRequest {
  if (!isObject(value) || !hasExactKeys(value, ['requirements', 'reason'])) {
    throw new ChorePlanRequirementError(
      'A requirement override accepts only requirements and a reason.',
      400,
    );
  }
  return {
    requirements: parseRequirements(value.requirements),
    reason: parseReason(value.reason),
  };
}

export function parseChorePlanRequirementOverrideClearRequest(
  value: unknown,
): ChorePlanRequirementOverrideClearRequest {
  if (!isObject(value) || !hasExactKeys(value, ['reason'])) {
    throw new ChorePlanRequirementError(
      'Clearing a requirement override accepts only a reason.',
      400,
    );
  }
  return { reason: parseReason(value.reason) };
}
