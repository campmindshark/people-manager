import SignupStatus, {
  NewPlaceholderSignupStatus,
} from '../view_models/signup_status';
import User from '../models/user/user';
import PrivateProfile from '../models/user/user_private';
import RosterParticipant from '../models/roster_participant/roster_participant';
import DuesPayment from '../models/dues_payment/dues_payment';
import { getConfig } from '../config/config';
import { loadChorePlanParticipantSignupStatus } from './chore_plan_participant_status';
import UserController from './user';

// this is a controller used to analyze things across many tables in the database
export default class AnalysisController {
  public static async GetSignupStatusForUser(
    userID: number,
    rosterID: number,
  ): Promise<SignupStatus> {
    const tmpResponse: SignupStatus = NewPlaceholderSignupStatus();
    tmpResponse.rosterID = rosterID;

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

    const isVerified = await UserController.isVerified(user);
    if (isVerified) {
      tmpResponse.isVerified = true;
    }

    // Check if the user has paid dues for this roster (only if they're signed up)
    if (rosterParticipant) {
      const duesPayment = await DuesPayment.query()
        .where({ userID, rosterID })
        .first();
      if (duesPayment && duesPayment.paid) {
        tmpResponse.hasPaidDues = true;
      }
    }

    if (rosterParticipant && getConfig().ChorePlanningEnabled) {
      const chorePlanStatus = await loadChorePlanParticipantSignupStatus(
        User.knex(),
        userID,
        rosterID,
      );
      if (chorePlanStatus) {
        Object.assign(tmpResponse, chorePlanStatus);
      }
    }

    return tmpResponse;
  }

  public static async GetSignupStatusForAllUsersInContextOfRoster(
    rosterID: number,
  ): Promise<SignupStatus[]> {
    const rosterParticipants = await RosterParticipant.query().where({
      rosterID,
    });

    const promises: Promise<SignupStatus>[] = [];
    for (let index = 0; index < rosterParticipants.length; index += 1) {
      promises.push(
        AnalysisController.GetSignupStatusForUser(
          rosterParticipants[index].userID,
          rosterID,
        ),
      );
    }

    const statuses = await Promise.all(promises);
    return statuses;
  }
}
