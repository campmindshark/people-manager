import axios from 'axios';
import {
  ChorePlanAdminAssignmentMutation,
  ChorePlanAdminAssignmentMutationResponse,
  ChorePlanAdminAssignmentViewResponse,
  ChorePlanForceAssignmentRequest,
} from 'backend/view_models/chore_plan_assignments';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDraftResponse,
  ChorePlanPreview,
  ChorePlanPreviewRequest,
} from 'backend/view_models/chore_plan_preview';
import { ChorePlanShiftViewResponse } from 'backend/view_models/chore_plan_shifts';
import {
  ChorePlanLifecycleResponse,
  ChorePlanLifecycleState,
} from 'backend/view_models/chore_plan_lifecycle';
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

  async GetAdminAssignments(
    rosterID: number,
  ): Promise<ChorePlanAdminAssignmentViewResponse> {
    const { data } = await axios.get<ChorePlanAdminAssignmentViewResponse>(
      `${this.baseApiURL}/api/chore-plans/admin/${rosterID}/assignments`,
      defaultRequestConfig,
    );
    return data;
  }

  async MutateAdminAssignments(
    rosterID: number,
    mutation: ChorePlanAdminAssignmentMutation,
  ): Promise<ChorePlanAdminAssignmentMutationResponse> {
    const { data } = await axios.post<ChorePlanAdminAssignmentMutationResponse>(
      `${this.baseApiURL}/api/chore-plans/admin/${rosterID}/assignments`,
      mutation,
      defaultRequestConfig,
    );
    return data;
  }

  async ForceAdminAssignments(
    rosterID: number,
    request: ChorePlanForceAssignmentRequest,
  ): Promise<ChorePlanAdminAssignmentMutationResponse> {
    const { data } = await axios.post<ChorePlanAdminAssignmentMutationResponse>(
      `${this.baseApiURL}/api/chore-plans/admin/${rosterID}/force-assignments`,
      request,
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
