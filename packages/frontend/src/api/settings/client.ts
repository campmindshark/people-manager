import axios from 'axios';
import defaultRequestConfig from '../common/requestConfig';

interface ActiveRosterResponse {
  activeRosterID: number;
}

export interface FrontendLinksResponse {
  essentialMindSharkURL: string;
}

export default class BackendSettingsClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetActiveRosterID(): Promise<number> {
    const { data } = await axios.get<ActiveRosterResponse>(
      `${this.baseApiURL}/api/settings/active-roster`,
      defaultRequestConfig,
    );
    return data.activeRosterID;
  }

  async SetActiveRosterID(rosterID: number): Promise<number> {
    const { data } = await axios.put<ActiveRosterResponse>(
      `${this.baseApiURL}/api/settings/active-roster`,
      { activeRosterID: rosterID },
      defaultRequestConfig,
    );
    return data.activeRosterID;
  }

  async GetFrontendLinks(): Promise<FrontendLinksResponse> {
    const { data } = await axios.get<FrontendLinksResponse>(
      `${this.baseApiURL}/api/settings/frontend-links`,
      defaultRequestConfig,
    );
    return data;
  }

  async SetFrontendLinks(
    frontendLinks: FrontendLinksResponse,
  ): Promise<FrontendLinksResponse> {
    const { data } = await axios.put<FrontendLinksResponse>(
      `${this.baseApiURL}/api/settings/frontend-links`,
      frontendLinks,
      defaultRequestConfig,
    );
    return data;
  }
}
