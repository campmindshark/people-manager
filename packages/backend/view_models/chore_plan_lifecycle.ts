import { ChorePlanStatus } from '../domain/chore_planning';

export interface ChorePlanLifecycleState {
  id: number;
  rosterID: number;
  status: ChorePlanStatus;
  openedAt: string | null;
  openedByUserID: number | null;
  closedAt: string | null;
  closedByUserID: number | null;
  updatedAt: string;
}
