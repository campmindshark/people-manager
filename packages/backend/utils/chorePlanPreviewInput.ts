import {
  ChorePlanApplyRequest,
  ChorePlanDisabledAssignment,
  ChorePlanPreviewRequest,
  ChorePlanRequirements,
} from '../view_models/chore_plan_preview';
import ChorePlanPreviewError from './chorePlanPreviewError';

export const MAX_CHORE_PLAN_CAMPERS = 200;
export const MAX_CHORE_PLAN_REQUIREMENT = 20;
export const MAX_DISABLED_CHORE_PLAN_ASSIGNMENTS = 500;
const SHIFT_KEY_PATTERN =
  /^(?:chore|event|dinner)\|[1-8]\|[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFINITION_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parsePositiveID(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ChorePlanPreviewError('Choose a valid roster.', 400);
  }
  return Number(value);
}

export function parseChorePlanRosterID(value: unknown): number {
  return parsePositiveID(
    typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
      ? Number(value)
      : value,
  );
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

function parseRevision(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new ChorePlanPreviewError(`${label} must be a valid revision.`, 400);
  }
  return value;
}

function disabledAssignmentIdentity(
  assignment: ChorePlanDisabledAssignment,
): string {
  return `${assignment.shiftKey}|${assignment.definitionKey}`;
}

function parseDisabledAssignments(
  value: unknown,
): ChorePlanDisabledAssignment[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_DISABLED_CHORE_PLAN_ASSIGNMENTS
  ) {
    throw new ChorePlanPreviewError(
      `Disabled assignments must be an array with at most ${MAX_DISABLED_CHORE_PLAN_ASSIGNMENTS} entries.`,
      400,
    );
  }
  const assignments = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ChorePlanPreviewError(
        'A disabled assignment must identify one shift and position.',
        400,
      );
    }
    const input = entry as Record<string, unknown>;
    const keys = Object.keys(input).sort();
    if (
      keys.length !== 2 ||
      keys[0] !== 'definitionKey' ||
      keys[1] !== 'shiftKey' ||
      typeof input.shiftKey !== 'string' ||
      !SHIFT_KEY_PATTERN.test(input.shiftKey) ||
      typeof input.definitionKey !== 'string' ||
      !DEFINITION_KEY_PATTERN.test(input.definitionKey)
    ) {
      throw new ChorePlanPreviewError(
        'A disabled assignment has an invalid shift or position key.',
        400,
      );
    }
    return {
      shiftKey: input.shiftKey,
      definitionKey: input.definitionKey,
    };
  });
  if (
    new Set(assignments.map(disabledAssignmentIdentity)).size !==
    assignments.length
  ) {
    throw new ChorePlanPreviewError(
      'Disabled assignments must be unique.',
      400,
    );
  }
  return [...assignments].sort((first, second) =>
    disabledAssignmentIdentity(first).localeCompare(
      disabledAssignmentIdentity(second),
    ),
  );
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
    (keys.length !== 3 && keys.length !== 4) ||
    keys[0] !== 'camperCount' ||
    (keys.length === 4 && keys[1] !== 'disabledAssignments') ||
    keys[keys.length - 2] !== 'requirements' ||
    keys[keys.length - 1] !== 'rosterID'
  ) {
    throw new ChorePlanPreviewError(
      'A preview accepts only rosterID, camperCount, requirements, and disabledAssignments.',
      400,
    );
  }

  return {
    rosterID: parsePositiveID(input.rosterID),
    camperCount: parseCamperCount(input.camperCount),
    requirements: parseRequirements(input.requirements),
    ...('disabledAssignments' in input
      ? {
          disabledAssignments: parseDisabledAssignments(
            input.disabledAssignments,
          ),
        }
      : {}),
  };
}

export function parseChorePlanApplyRequest(
  value: unknown,
): ChorePlanApplyRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChorePlanPreviewError('Enter draft details.', 400);
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  if (
    (keys.length !== 5 && keys.length !== 6) ||
    keys[0] !== 'camperCount' ||
    (keys.length === 6 && keys[1] !== 'disabledAssignments') ||
    keys[keys.length - 4] !== 'expectedCatalogRevision' ||
    keys[keys.length - 3] !== 'expectedDraftRevision' ||
    keys[keys.length - 2] !== 'requirements' ||
    keys[keys.length - 1] !== 'rosterID'
  ) {
    throw new ChorePlanPreviewError(
      'A draft apply accepts only rosterID, camperCount, requirements, disabledAssignments, expectedCatalogRevision, and expectedDraftRevision.',
      400,
    );
  }

  const preview = parseChorePlanPreviewRequest({
    rosterID: input.rosterID,
    camperCount: input.camperCount,
    requirements: input.requirements,
    ...('disabledAssignments' in input
      ? { disabledAssignments: input.disabledAssignments }
      : {}),
  });
  const expectedDraftRevision =
    input.expectedDraftRevision === null
      ? null
      : parseRevision(input.expectedDraftRevision, 'Expected draft revision');

  return {
    ...preview,
    expectedCatalogRevision: parseRevision(
      input.expectedCatalogRevision,
      'Expected catalog revision',
    ),
    expectedDraftRevision,
  };
}
