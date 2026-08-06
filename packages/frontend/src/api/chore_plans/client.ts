import axios from 'axios';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDraftResponse,
  ChorePlanPreview,
  ChorePlanPreviewRequest,
} from 'backend/view_models/chore_plan_preview';
import {
  ChorePlanLifecycleResponse,
  ChorePlanLifecycleState,
} from 'backend/view_models/chore_plan_lifecycle';
import defaultRequestConfig from '../common/requestConfig';

export default class BackendChorePlanClient {
  private readonly baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async Preview(request: ChorePlanPreviewRequest): Promise<ChorePlanPreview> {
    const { data } = await axios.post<ChorePlanPreview>(
      `${this.baseApiURL}/api/chore-plans/preview`,
      request,
      defaultRequestConfig,
    );
    return data;
  }

  async GetDraft(rosterID: number): Promise<ChorePlanDraftResponse> {
    const { data } = await axios.get<ChorePlanDraftResponse>(
      `${this.baseApiURL}/api/chore-plans/draft/${rosterID}`,
      defaultRequestConfig,
    );
    return data;
  }

  async Apply(request: ChorePlanApplyRequest): Promise<ChorePlanApplyResponse> {
    const { data } = await axios.post<ChorePlanApplyResponse>(
      `${this.baseApiURL}/api/chore-plans/apply`,
      request,
      defaultRequestConfig,
    );
    return data;
  }

  async GetLifecycle(rosterID: number): Promise<ChorePlanLifecycleResponse> {
    const { data } = await axios.get<ChorePlanLifecycleResponse>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/lifecycle`,
      defaultRequestConfig,
    );
    return data;
  }

  async Open(rosterID: number): Promise<ChorePlanLifecycleState> {
    const { data } = await axios.post<ChorePlanLifecycleState>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/open`,
      {},
      defaultRequestConfig,
    );
    return data;
  }

  async Close(rosterID: number): Promise<ChorePlanLifecycleState> {
    const { data } = await axios.post<ChorePlanLifecycleState>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/close`,
      {},
      defaultRequestConfig,
    );
    return data;
  }

  async Reopen(
    rosterID: number,
    reason: string,
  ): Promise<ChorePlanLifecycleState> {
    const { data } = await axios.post<ChorePlanLifecycleState>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/reopen`,
      { reason },
      defaultRequestConfig,
    );
    return data;
  }
}
