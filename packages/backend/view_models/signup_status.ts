import User from '../models/user/user';
import { ChorePlanStatus } from '../domain/chore_planning';
import { ChorePlanRequirements } from './chore_plan_preview';

type SignupStatus = {
  user: User;

  hasSignedUpForRoster: boolean;
  rosterID: number;

  hasCompletedPrivateProfile: boolean;
  hasCompletedPublicProfile: boolean;

  hasPaidDues: boolean;
  isVerified: boolean;

  chorePlanStatus: ChorePlanStatus | null;
  choreSignupsOpen: boolean;
  requirements: ChorePlanRequirements;
  hasCustomRequirements: boolean;
  requirementExceptionReason: string | null;
  choreShiftCount: number;
  eventShiftCount: number;
  dinnerShiftCount: number;
  shiftCount: number;
};

export const NewPlaceholderSignupStatus = (): SignupStatus => ({
  user: new User(),
  hasSignedUpForRoster: false,
  rosterID: 0,
  hasCompletedPrivateProfile: false,
  hasCompletedPublicProfile: false,
  hasPaidDues: false,
  isVerified: false,
  chorePlanStatus: null,
  choreSignupsOpen: false,
  requirements: { chore: 0, event: 0, dinner: 0 },
  hasCustomRequirements: false,
  requirementExceptionReason: null,
  choreShiftCount: 0,
  eventShiftCount: 0,
  dinnerShiftCount: 0,
  shiftCount: 0,
});

function naturalList(items: string[]): string {
  if (items.length < 2) {
    return items[0] ?? '';
  }
  if (items.length === 2) {
    return items.join(' and ');
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export const signupStatusIssues = (status: SignupStatus): string[] => {
  const issues: string[] = [];

  if (!status.hasSignedUpForRoster) {
    issues.push('You have not signed up for this roster.');
  }

  if (!status.hasCompletedPrivateProfile) {
    issues.push('You have not completed your private profile.');
  }

  if (!status.hasCompletedPublicProfile) {
    issues.push('You have not completed your public profile.');
  }

  // if (!status.hasPaidDues) {
  //   issues.push('You have not paid your dues.');
  // }

  if (!status.isVerified) {
    issues.push('You have not been verified.');
  }

  if (status.hasSignedUpForRoster && status.choreSignupsOpen) {
    const missingShifts = [
      {
        kind: 'chore',
        remaining: status.requirements.chore - status.choreShiftCount,
      },
      {
        kind: 'event',
        remaining: status.requirements.event - status.eventShiftCount,
      },
      {
        kind: 'dinner',
        remaining: status.requirements.dinner - status.dinnerShiftCount,
      },
    ]
      .filter(({ remaining }) => remaining > 0)
      .map(
        ({ kind, remaining }) =>
          `${remaining} ${kind} shift${remaining === 1 ? '' : 's'}`,
      );
    if (missingShifts.length > 0) {
      issues.push(
        `Chore signups are open. You still need to sign up for ${naturalList(
          missingShifts,
        )}.`,
      );
    }
  }

  return issues;
};

export default SignupStatus;
