import Shift from '../models/shift/shift';
import User from '../models/user/user';
import { ChorePlanStatus } from './chore_plan';

export const SHIFT_SIGNUP_RESTRICTION_MESSAGES = {
  existingShiftConflict:
    'This shift conflicts with another shift you are already signed up for.',
  prioritySignupNotOpen:
    'Shift signup is not open for your priority group yet.',
  outsideAttendanceWindow:
    'This shift falls outside your estimated arrival and departure. Update your roster signup if your plans have changed.',
  rosterSignupRequired:
    'You must be signed up for this roster before choosing shifts.',
  signupGroupRequired:
    'You are not assigned to a shift signup group for this roster. Contact an administrator.',
} as const;

export default interface ShiftViewModel {
  shift: Shift;
  scheduleName: string;
  participants: User[];
  signupOpen: boolean;
  chorePlanStatus?: ChorePlanStatus | null;
  signupRestrictionReason?: string | null;
  signupConflictShiftIDs?: number[];
}

export function shiftSignUpStatus(
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
