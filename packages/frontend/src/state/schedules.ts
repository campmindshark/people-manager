import { atom } from 'recoil';
import Schedule from 'backend/models/schedule/schedule';

export const ScheduleState = atom<Schedule[]>({
  key: 'scheduleState',
  default: [],
});
