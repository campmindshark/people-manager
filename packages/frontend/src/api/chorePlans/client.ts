import axios from 'axios';
import ChorePlanPreview, {
  ChorePlanApplyResult,
  ChorePlanParticipantRequirements,
  ChorePlanReadiness,
  ChorePlanRequirements,
  ChorePlanSummary,
} from 'backend/view_models/chore_plan';
import ChorePlanAuditEntry from 'backend/view_models/chore_plan_audit';
import defaultRequestConfig from '../common/requestConfig';

interface ChorePlanRequest {
  rosterID: number;
  camperCount: number;
  sheetUrl: string;
  requirements: ChorePlanRequirements;
}

export default class BackendChorePlanClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetPlan(rosterID: number): Promise<ChorePlanSummary | null> {
    const { data } = await axios.get<{ plan: ChorePlanSummary | null }>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}`,
      defaultRequestConfig,
    );
    return data.plan;
  }

  async GetAuditLog(rosterID: number): Promise<ChorePlanAuditEntry[]> {
    const { data } = await axios.get<{ entries: ChorePlanAuditEntry[] }>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/audit-log`,
      defaultRequestConfig,
    );
    return data.entries;
  }

  async Preview(request: ChorePlanRequest): Promise<ChorePlanPreview> {
    const { data } = await axios.post<ChorePlanPreview>(
      `${this.baseApiURL}/api/chore-plans/preview`,
      request,
      defaultRequestConfig,
    );
    return data;
  }

  async Generate(request: ChorePlanRequest): Promise<ChorePlanApplyResult> {
    const { data } = await axios.post<ChorePlanApplyResult>(
      `${this.baseApiURL}/api/chore-plans/generate`,
      request,
      defaultRequestConfig,
    );
    return data;
  }

  async GetReadiness(rosterID: number): Promise<ChorePlanReadiness> {
    const { data } = await axios.get<ChorePlanReadiness>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/readiness`,
      defaultRequestConfig,
    );
    return data;
  }

  async OpenSignups(rosterID: number): Promise<ChorePlanSummary> {
    const { data } = await axios.post<{ plan: ChorePlanSummary }>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/open-signups`,
      undefined,
      defaultRequestConfig,
    );
    return data.plan;
  }

  async CloseSignups(rosterID: number): Promise<ChorePlanSummary> {
    const { data } = await axios.post<{ plan: ChorePlanSummary }>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/close-signups`,
      undefined,
      defaultRequestConfig,
    );
    return data.plan;
  }

  async SetParticipantRequirements(
    rosterID: number,
    userID: number,
    requirements: ChorePlanRequirements,
    reason: string,
  ): Promise<ChorePlanParticipantRequirements> {
    const { data } = await axios.put<ChorePlanParticipantRequirements>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/participants/${userID}/requirements`,
      { requirements, reason },
      defaultRequestConfig,
    );
    return data;
  }

  async ResetParticipantRequirements(
    rosterID: number,
    userID: number,
  ): Promise<ChorePlanParticipantRequirements> {
    const { data } = await axios.delete<ChorePlanParticipantRequirements>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/participants/${userID}/requirements`,
      defaultRequestConfig,
    );
    return data;
  }
}
