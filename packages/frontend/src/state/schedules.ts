import { atom } from 'recoil';
import Schedule from 'backend/models/schedule/schedule';

const ScheduleState = atom<Schedule[]>({
  key: 'scheduleState',
  default: [],
});

export default ScheduleState;
