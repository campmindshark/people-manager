import axios from 'axios';
import Schedule from 'backend/models/schedule/schedule';
import defaultRequestConfig from '../common/requestConfig';

export interface ScheduleClient {
  GetAllSchedules(): Promise<Schedule[]>;
}

export default class BackendScheduleClient implements ScheduleClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllSchedules(): Promise<Schedule[]> {
    const { data } = await axios.get<Schedule[]>(
      `${this.baseApiURL}/api/schedules`,
      defaultRequestConfig,
    );
    return data;
  }
}
