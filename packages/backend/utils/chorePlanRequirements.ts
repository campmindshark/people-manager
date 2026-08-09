import { ChorePlanKind } from '../domain/chore_planning';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';

export interface ChorePlanRequirementColumns {
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
}

const REQUIREMENT_COLUMNS: Record<
  ChorePlanKind,
  keyof ChorePlanRequirementColumns
> = {
  chore: 'choreRequirement',
  event: 'eventRequirement',
  dinner: 'dinnerRequirement',
};

export function requirementsFromColumns(
  row: ChorePlanRequirementColumns,
  maximums?: ChorePlanRequirements,
): ChorePlanRequirements {
  const requirements = {} as ChorePlanRequirements;
  (['chore', 'event', 'dinner'] as const).forEach((kind) => {
    const requirement = Number(row[REQUIREMENT_COLUMNS[kind]]);
    if (
      !Number.isInteger(requirement) ||
      requirement < 0 ||
      requirement > 20 ||
      (maximums !== undefined && requirement > maximums[kind])
    ) {
      throw new Error(`A stored ${kind} requirement is invalid.`);
    }
    requirements[kind] = requirement;
  });
  return requirements;
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
  plan: ChorePlanRequirementColumns,
  override?: ChorePlanRequirementColumns | null,
): ChorePlanRequirements {
  const planRequirements = requirementsFromColumns(plan);
  return override
    ? requirementsFromColumns(override, planRequirements)
    : planRequirements;
}

export function requirementForKind(
  requirements: ChorePlanRequirements,
  kind: ChorePlanKind,
): number {
  return requirements[kind];
}
