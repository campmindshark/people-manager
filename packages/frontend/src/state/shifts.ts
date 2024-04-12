import { selector } from 'recoil';
import ShiftViewModel from 'backend/view_models/shift';
import { getFrontendConfig } from '../config/config';
import BackendShiftClient from '../api/shifts/shifts';

const frontendConfig = getFrontendConfig();

export async function getShiftMap(): Promise<Map<number, ShiftViewModel>> {
  const shiftMap = new Map<number, ShiftViewModel>();
  const client = new BackendShiftClient(frontendConfig.BackendURL);
  const shifts = await client.GetShiftsByRosterID(frontendConfig.RosterID);

  console.log('shifts', shifts);

  for (let index = 0; index < shifts.length; index += 1) {
    const shift = shifts[index];
    shiftMap.set(shift.shift.id, shift);
  }
  console.log('shiftMap', shiftMap);
  return shiftMap;
}

const ShiftState = selector<Map<number, ShiftViewModel>>({
  key: 'shiftState',
  get: async () => getShiftMap(),
});

export default ShiftState;
