import Shift from '../models/shift/shift';
import User from '../models/user/user';

export default interface ShiftViewModel {
  shift: Shift;
  scheduleName: string;
  participants: User[];
}

export function shiftSignupStatus(
  shiftViewModel: ShiftViewModel,
): 'understaffed' | 'staffed' | 'overstaffed' {
  if (
    shiftViewModel.participants.length <
    shiftViewModel.shift.requiredParticipants
  ) {
    return 'understaffed';
  }

  if (
    shiftViewModel.participants.length >
    shiftViewModel.shift.requiredParticipants
  ) {
    return 'overstaffed';
  }
  return 'staffed';
}

export function userIsSignedUpForShift(
  shiftViewModel: ShiftViewModel,
  userID: number,
): boolean {
  return shiftViewModel.participants.some(
    (participant) => participant.id === userID,
  );
}
