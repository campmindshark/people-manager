import SignupStatus, {
  NewPlaceholderSignupStatus,
} from '../view_models/signup_status';
import User from '../models/user/user';
import PrivateProfile from '../models/user/user_private';
import RosterParticipant from '../models/roster_participant/roster_participant';

// this is a controller used to analyze things across many tables in the database
export default class AnalysisController {
  public static async GetSignupStatusForUser(
    userID: number,
    rosterID: number,
  ): Promise<SignupStatus> {
    const tmpResponse: SignupStatus = NewPlaceholderSignupStatus();

    // Get the user profile to determine if its been completed
    const user = await User.query().findById(userID);
    if (!user) {
      throw new Error('User not found');
    }
    tmpResponse.user = user;
    if (user.hasCompletedProfile()) {
      tmpResponse.hasCompletedPublicProfile = true;
    }

    // Get the user's private profile to determine if its been completed
    const privateProfile = await PrivateProfile.query().where('userID', userID);
    if (privateProfile.length > 0) {
      tmpResponse.hasCompletedPrivateProfile = true;
    }

    // Get the roster participant entry to confirm if they've signed up
    const rosterParticipant = await RosterParticipant.query()
      .where({ userID, rosterID })
      .first();
    if (rosterParticipant) {
      tmpResponse.hasSignedUpForRoster = true;
    }

    // TODO: add logic to determine if the user has paid dues
    // TODO: add logic to determine if the user has signed up for shifts
    // TODO: add logic to determine if the user has completed the required number of shifts

    return tmpResponse;
  }

  public static async GetSignupStatusForAllUsersInContextOfRoster(
    rosterID: number,
  ): Promise<SignupStatus[]> {
    const rosterParticipants = await RosterParticipant.query().where({
      rosterID,
    });

    const response: SignupStatus[] = [];
    for (const participant of rosterParticipants) {
      const status = await AnalysisController.GetSignupStatusForUser(
        participant.userID,
        rosterID,
      );
      response.push(status);
    }

    return response;
  }
}
