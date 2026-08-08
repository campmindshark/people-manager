import User from '../models/user/user';

type SignupStatus = {
  user: User;

  hasSignedUpForRoster: boolean;
  rosterID: number;

  hasCompletedPrivateProfile: boolean;
  hasCompletedPublicProfile: boolean;

  hasPaidDues: boolean;
  isVerified: boolean;

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
  shiftCount: 0,
});

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

  return issues;
};

export default SignupStatus;
