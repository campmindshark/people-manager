import { ChorePlanStatus } from '../domain/chore_planning';
import { ChorePlanRequirements } from './chore_plan_preview';

export interface ChorePlanLifecycleState {
  id: number;
  rosterID: number;
  status: ChorePlanStatus;
  draftRevision: string;
  planningYear: number;
  camperCount: number;
  requirements: ChorePlanRequirements;
  shiftCount: number;
  slotCount: number;
  openedAt: string | null;
  openedByUserID: number | null;
  closedAt: string | null;
  closedByUserID: number | null;
  updatedAt: string;
}

export interface ChorePlanLifecycleResponse {
  plan: ChorePlanLifecycleState | null;
}

export interface ChorePlanOpenRequest {
  expectedDraftRevision: string;
}
