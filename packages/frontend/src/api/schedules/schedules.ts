import axios from 'axios';
import Schedule from 'backend/models/schedule/schedule';

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
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );
    return data;
  }
}
