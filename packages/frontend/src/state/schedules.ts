import { selector } from 'recoil';
import Schedule from 'backend/models/schedule/schedule';
import { getConfig } from 'backend/config/config';
import { CurrentRosterState } from './roster';
import BackendScheduleClient from '../api/schedules/schedules';

const appConfig = getConfig();
const scheduleClient = new BackendScheduleClient(appConfig.BackendURL);

const CurrentRosterScheduleState = selector<Schedule[]>({
  key: 'currentRosterScheduleState',
  get: async ({ get }) => {
    const roster = get(CurrentRosterState);
    console.log(
      `we should eventually only load schedules for a specific roster ${roster.id}`,
    );
    const participants = await scheduleClient.GetAllSchedules();
    return participants;
  },
});

export default CurrentRosterScheduleState;
