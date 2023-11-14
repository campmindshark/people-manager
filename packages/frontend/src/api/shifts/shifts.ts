import axios from 'axios';
import Shift from 'backend/models/shift/shift';

export interface ShiftClient {
  GetAllShifts(): Promise<Shift[]>;
}

export default class BackendShiftClient implements ShiftClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllShifts(): Promise<Shift[]> {
    const { data } = await axios.get<Shift[]>(`${this.baseApiURL}/api/shifts`, {
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
    return data;
  }
}
