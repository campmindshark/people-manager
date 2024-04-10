import axios from 'axios';
import Shift from 'backend/models/shift/shift';
import ShiftViewModel from 'backend/view_models/shift';
import defaultRequestConfig from '../common/requestConfig';

export interface ShiftClient {
  GetAllShifts(): Promise<Shift[]>;
  GetShiftViewModelsBySchedule(scheduleID: number): Promise<ShiftViewModel[]>;
  GetShiftsByParticipantID(scheduleID: number): Promise<ShiftViewModel[]>;
}

export default class BackendShiftClient implements ShiftClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllShifts(): Promise<Shift[]> {
    const { data } = await axios.get<Shift[]>(
      `${this.baseApiURL}/api/shifts`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetShiftViewModelsBySchedule(
    scheduleID: number,
  ): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/schedules/${scheduleID}/shifts`,
      defaultRequestConfig,
    );
    return data;
  }

  async SignUpForShift(shiftID: number): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/${shiftID}/signup`,
      defaultRequestConfig,
    );
    return data;
  }

  async UnregisterFromShift(shiftID: number): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/${shiftID}/unregister`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetShiftsByParticipantID(userID: number): Promise<ShiftViewModel[]> {
    if (!userID) {
      console.log('undefined userID, cannot query shifts by participantID');
      return [];
    }

    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/by_participantID/${userID}`,
      defaultRequestConfig,
    );

    return data;
  }

  async GetMyShifts(): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/my-shifts`,
      defaultRequestConfig,
    );

    return data;
  }
}
