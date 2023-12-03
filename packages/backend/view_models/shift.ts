import Shift from '../models/shift/shift';

export default interface ShiftViewModel {
  shift: Shift;
  scheduleName: string;
  participants: string[];
}
