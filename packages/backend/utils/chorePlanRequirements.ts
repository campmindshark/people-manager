import {
  CHORE_PLAN_KINDS,
  ChorePlanKind,
  ChorePlanRequirements,
  MAX_CHORE_PLAN_REQUIREMENT,
} from '../view_models/chore_plan';
import ChorePlanError from './chorePlanError';

export interface ChorePlanRequirementColumns {
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
}

export const REQUIREMENT_COLUMNS: Record<
  ChorePlanKind,
  keyof ChorePlanRequirementColumns
> = {
  chore: 'choreRequirement',
  event: 'eventRequirement',
  dinner: 'dinnerRequirement',
};

export function requirementsFromColumns(
  row: ChorePlanRequirementColumns,
): ChorePlanRequirements {
  return {
    chore: Number(row.choreRequirement),
    event: Number(row.eventRequirement),
    dinner: Number(row.dinnerRequirement),
  };
}

export function requirementsToColumns(
  requirements: ChorePlanRequirements,
): ChorePlanRequirementColumns {
  return {
    choreRequirement: requirements.chore,
    eventRequirement: requirements.event,
    dinnerRequirement: requirements.dinner,
  };
}

export function effectiveRequirements(
  planRequirements: ChorePlanRequirements,
  customRequirements?: ChorePlanRequirements | null,
): ChorePlanRequirements {
  if (!customRequirements) {
    return planRequirements;
  }

  return Object.fromEntries(
    CHORE_PLAN_KINDS.map((kind) => [
      kind,
      Math.min(planRequirements[kind], customRequirements[kind]),
    ]),
  ) as ChorePlanRequirements;
}

export function validateRequirements(
  value: unknown,
  maximums?: ChorePlanRequirements,
): ChorePlanRequirements {
  if (!value || typeof value !== 'object') {
    throw new ChorePlanError(
      'Enter chore, event, and dinner requirements.',
      400,
    );
  }

  const input = value as Record<string, unknown>;
  const requirements = Object.fromEntries(
    CHORE_PLAN_KINDS.map((kind) => [kind, Number(input[kind])]),
  ) as ChorePlanRequirements;

  CHORE_PLAN_KINDS.forEach((kind) => {
    const requirement = requirements[kind];
    const maximum = maximums?.[kind] ?? MAX_CHORE_PLAN_REQUIREMENT;
    if (
      !Number.isInteger(requirement) ||
      requirement < 0 ||
      requirement > maximum
    ) {
      throw new ChorePlanError(
        `${kind[0].toUpperCase()}${kind.slice(
          1,
        )} requirements must be a whole number from 0 to ${maximum}.`,
        400,
      );
    }
  });

  return requirements;
}
