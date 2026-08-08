import { ChoreCatalogKind } from './chore_catalog';
import { ChorePlanRequirements } from './chore_plan_preview';

export type ChorePlanChangeHistoryAction =
  | 'draft_applied'
  | 'draft_replaced'
  | 'plan_opened'
  | 'plan_closed'
  | 'plan_reopened'
  | 'admin_assignment_mutated'
  | 'participant_requirements_overridden'
  | 'participant_requirements_cleared';

export interface ChorePlanChangeHistoryUser {
  id: number;
  name: string;
}

export interface ChorePlanChangeHistoryShift {
  id: number;
  stableKey: string | null;
  kind: ChoreCatalogKind | null;
  scheduleName: string;
  displayDayLabel: string | null;
  timePeriodLabel: string | null;
}

export interface ChorePlanChangeHistoryAssignment {
  action: 'added' | 'removed';
  participant: ChorePlanChangeHistoryUser;
  shift: ChorePlanChangeHistoryShift;
}

export interface ChorePlanDraftAuditSnapshot {
  draftRevision: string;
  catalogRevision: string;
  generationHash: string;
  planningYear: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
  scheduleCount: number;
  shiftCount: number;
  slotCount: number;
}

interface ChorePlanChangeHistoryEntryBase {
  id: number;
  chorePlanID: number;
  actor: ChorePlanChangeHistoryUser;
  createdAt: string;
}

export interface ChorePlanDraftChangeHistoryEntry extends ChorePlanChangeHistoryEntryBase {
  action: 'draft_applied' | 'draft_replaced';
  details: {
    previous: ChorePlanDraftAuditSnapshot | null;
    current: ChorePlanDraftAuditSnapshot;
  };
}

export interface ChorePlanLifecycleChangeHistoryEntry extends ChorePlanChangeHistoryEntryBase {
  action: 'plan_opened' | 'plan_closed' | 'plan_reopened';
  details: {
    fromStatus: 'draft' | 'open' | 'closed';
    toStatus: 'draft' | 'open' | 'closed';
    reason: string | null;
  };
}

export interface ChorePlanAssignmentChangeHistoryEntry extends ChorePlanChangeHistoryEntryBase {
  action: 'admin_assignment_mutated';
  details: {
    operation: 'assign' | 'unassign' | 'move' | 'swap';
    affectedAssignments: ChorePlanChangeHistoryAssignment[];
    forced: boolean;
    reason: string | null;
    bypassedRules: string[];
  };
}

export interface ChorePlanRequirementChangeHistoryEntry extends ChorePlanChangeHistoryEntryBase {
  action:
    'participant_requirements_overridden' | 'participant_requirements_cleared';
  details: {
    participant: ChorePlanChangeHistoryUser;
    previousRequirements: ChorePlanRequirements;
    requirements: ChorePlanRequirements;
    previousReason: string | null;
    reason: string;
    removedAssignments: ChorePlanChangeHistoryAssignment[];
  };
}

export type ChorePlanChangeHistoryEntry =
  | ChorePlanDraftChangeHistoryEntry
  | ChorePlanLifecycleChangeHistoryEntry
  | ChorePlanAssignmentChangeHistoryEntry
  | ChorePlanRequirementChangeHistoryEntry;

export interface ChorePlanChangeHistoryResponse {
  rosterID: number;
  entries: ChorePlanChangeHistoryEntry[];
  hasMore: boolean;
}
