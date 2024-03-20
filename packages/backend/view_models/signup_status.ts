type SignupStatus = {
  userID: number;

  hasSignedUpForRoster: boolean;
  rosterID: number;

  hasCompletedPrivateProfile: boolean;
  hasCompletedPublicProfile: boolean;

  hasPaidDues: boolean;

  shiftCount: number;
};

export const NewPlaceholderSignupStatus = (): SignupStatus => {
  return {
    userID: 0,
    hasSignedUpForRoster: false,
    rosterID: 0,
    hasCompletedPrivateProfile: false,
    hasCompletedPublicProfile: false,
    hasPaidDues: false,
    shiftCount: 0,
  };
};

export default SignupStatus;
