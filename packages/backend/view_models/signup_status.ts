import User from '../models/user/user';

type SignupStatus = {
  user: User;

  hasSignedUpForRoster: boolean;
  rosterID: number;

  hasCompletedPrivateProfile: boolean;
  hasCompletedPublicProfile: boolean;

  hasPaidDues: boolean;

  shiftCount: number;
};

export const NewPlaceholderSignupStatus = (): SignupStatus => ({
  user: new User(),
  hasSignedUpForRoster: false,
  rosterID: 0,
  hasCompletedPrivateProfile: false,
  hasCompletedPublicProfile: false,
  hasPaidDues: false,
  shiftCount: 0,
});

export default SignupStatus;
