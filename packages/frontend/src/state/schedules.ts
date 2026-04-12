import { selector } from 'recoil';
import Schedule from 'backend/models/schedule/schedule';
import { getFrontendConfig } from '../config/config';
import { CurrentRosterState } from './roster';
import BackendScheduleClient from '../api/schedules/schedules';

const frontendConfig = getFrontendConfig();
const scheduleClient = new BackendScheduleClient(frontendConfig.BackendURL);

const CurrentRosterScheduleState = selector<Schedule[]>({
  key: 'currentRosterScheduleState',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    const schedules = await scheduleClient.GetAllSchedules();
    return schedules.filter((schedule) => schedule.rosterID === roster.id);
  },
});

export default CurrentRosterScheduleState;
