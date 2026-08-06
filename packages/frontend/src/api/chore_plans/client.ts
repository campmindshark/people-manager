import axios from 'axios';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDraftResponse,
  ChorePlanPreview,
  ChorePlanPreviewRequest,
} from 'backend/view_models/chore_plan_preview';
import { ChorePlanShiftViewResponse } from 'backend/view_models/chore_plan_shifts';
import {
  ChorePlanSignupMutationResponse,
  ChorePlanSignupRequest,
  ChorePlanSwitchRequest,
} from 'backend/view_models/chore_plan_signup';
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

  async GetShifts(rosterID: number): Promise<ChorePlanShiftViewResponse> {
    const { data } = await axios.get<ChorePlanShiftViewResponse>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/shifts`,
      defaultRequestConfig,
    );
    return data;
  }

  async Signup(
    rosterID: number,
    request: ChorePlanSignupRequest,
  ): Promise<ChorePlanSignupMutationResponse> {
    const { data } = await axios.post<ChorePlanSignupMutationResponse>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/signup`,
      request,
      defaultRequestConfig,
    );
    return data;
  }

  async Remove(
    rosterID: number,
    shiftID: number,
  ): Promise<ChorePlanSignupMutationResponse> {
    const { data } = await axios.delete<ChorePlanSignupMutationResponse>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/signup/${shiftID}`,
      defaultRequestConfig,
    );
    return data;
  }

  async Switch(
    rosterID: number,
    request: ChorePlanSwitchRequest,
  ): Promise<ChorePlanSignupMutationResponse> {
    const { data } = await axios.post<ChorePlanSignupMutationResponse>(
      `${this.baseApiURL}/api/chore-plans/${rosterID}/switch`,
      request,
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
}
