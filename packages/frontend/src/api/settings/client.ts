import axios from 'axios';
import defaultRequestConfig from '../common/requestConfig';

interface ActiveRosterResponse {
  activeRosterID: number;
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
}
