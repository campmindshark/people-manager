export type ChorePlanOperationalEventName =
  | 'chore_plan.preview_generated'
  | 'chore_plan.draft_applied'
  | 'chore_plan.lifecycle_changed'
  | 'chore_plan.signup_rejected'
  | 'chore_plan.capacity_conflict'
  | 'chore_plan.admin_force_completed';

export type ChorePlanOperationalEventLevel = 'info' | 'warning';

export type ChorePlanOperationalEventValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, number>;

export type ChorePlanOperationalEventFields = Record<
  string,
  ChorePlanOperationalEventValue
>;

export interface ChorePlanOperationalEvent extends ChorePlanOperationalEventFields {
  timestamp: string;
  level: ChorePlanOperationalEventLevel;
  event: ChorePlanOperationalEventName;
}

export function buildChorePlanOperationalEvent(
  event: ChorePlanOperationalEventName,
  fields: ChorePlanOperationalEventFields,
  level: ChorePlanOperationalEventLevel = 'info',
  observedAt = new Date(),
): ChorePlanOperationalEvent {
  return {
    timestamp: observedAt.toISOString(),
    level,
    event,
    ...fields,
  };
}

export function logChorePlanOperationalEvent(
  event: ChorePlanOperationalEventName,
  fields: ChorePlanOperationalEventFields,
  level: ChorePlanOperationalEventLevel = 'info',
): void {
  const serialized = JSON.stringify(
    buildChorePlanOperationalEvent(event, fields, level),
  );
  if (level === 'warning') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}
