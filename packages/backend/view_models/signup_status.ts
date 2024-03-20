type SignupStatus = {
  userID: number;

  hasSignedUpForRoster: boolean;
  rosterID: number;

  hasCompletedPrivateProfile: boolean;
  hasCompletedPublicProfile: boolean;

  hasPaidDues: boolean;

  shiftCount: number;
};
