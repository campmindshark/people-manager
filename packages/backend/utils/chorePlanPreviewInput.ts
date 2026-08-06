import {
  ChorePlanPreviewRequest,
  ChorePlanRequirements,
} from '../view_models/chore_plan_preview';
import ChorePlanPreviewError from './chorePlanPreviewError';

export const MAX_CHORE_PLAN_CAMPERS = 200;
export const MAX_CHORE_PLAN_REQUIREMENT = 20;

function parsePositiveID(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ChorePlanPreviewError('Choose a valid roster.', 400);
  }
  return Number(value);
}

function parseCamperCount(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    Number(value) < 1 ||
    Number(value) > MAX_CHORE_PLAN_CAMPERS
  ) {
    throw new ChorePlanPreviewError(
      `Camper count must be a whole number from 1 to ${MAX_CHORE_PLAN_CAMPERS}.`,
      400,
    );
  }
  return Number(value);
}

function parseRequirements(value: unknown): ChorePlanRequirements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChorePlanPreviewError(
      'Enter chore, event, and dinner requirements.',
      400,
    );
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'chore' ||
    keys[1] !== 'dinner' ||
    keys[2] !== 'event'
  ) {
    throw new ChorePlanPreviewError(
      'Requirements must contain only chore, event, and dinner.',
      400,
    );
  }

  const parsed = {} as ChorePlanRequirements;
  (['chore', 'event', 'dinner'] as const).forEach((kind) => {
    const requirement = input[kind];
    if (
      !Number.isInteger(requirement) ||
      Number(requirement) < 0 ||
      Number(requirement) > MAX_CHORE_PLAN_REQUIREMENT
    ) {
      throw new ChorePlanPreviewError(
        `${kind[0].toUpperCase()}${kind.slice(
          1,
        )} requirements must be a whole number from 0 to ${MAX_CHORE_PLAN_REQUIREMENT}.`,
        400,
      );
    }
    parsed[kind] = Number(requirement);
  });
  return parsed;
}

export function parseChorePlanPreviewRequest(
  value: unknown,
): ChorePlanPreviewRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChorePlanPreviewError('Enter preview details.', 400);
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'camperCount' ||
    keys[1] !== 'requirements' ||
    keys[2] !== 'rosterID'
  ) {
    throw new ChorePlanPreviewError(
      'A preview accepts only rosterID, camperCount, and requirements.',
      400,
    );
  }

  return {
    rosterID: parsePositiveID(input.rosterID),
    camperCount: parseCamperCount(input.camperCount),
    requirements: parseRequirements(input.requirements),
  };
}
