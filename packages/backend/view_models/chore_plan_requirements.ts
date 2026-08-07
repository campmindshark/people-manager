import { ChorePlanRequirements } from './chore_plan_preview';

export interface ChorePlanRequirementOverridePlan {
  id: number;
  status: 'draft' | 'open' | 'closed';
  requirements: ChorePlanRequirements;
}

export interface ChorePlanParticipantRequirements {
  userID: number;
  firstName: string;
  lastName: string;
  playaName: string;
  requirements: ChorePlanRequirements;
  hasOverride: boolean;
  overrideReason: string | null;
}

export interface ChorePlanRequirementOverrideViewResponse {
  rosterID: number;
  plan: ChorePlanRequirementOverridePlan | null;
  mutationsAllowed: boolean;
  participants: ChorePlanParticipantRequirements[];
}

export interface ChorePlanRequirementOverrideRequest {
  requirements: ChorePlanRequirements;
  reason: string;
}

export interface ChorePlanRequirementOverrideClearRequest {
  reason: string;
}

export interface ChorePlanRequirementOverrideMutationResponse {
  changed: boolean;
  participant: ChorePlanParticipantRequirements;
}
