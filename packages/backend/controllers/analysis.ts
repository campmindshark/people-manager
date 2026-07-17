import Knex from 'knex';
import SignupStatus, {
  NewPlaceholderSignupStatus,
} from '../view_models/signup_status';
import User from '../models/user/user';
import PrivateProfile from '../models/user/user_private';
import RosterParticipant from '../models/roster_participant/roster_participant';
import DuesPayment from '../models/dues_payment/dues_payment';
import UserController from './user';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import { ChorePlanStatus } from '../view_models/chore_plan';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
  requirementsFromColumns,
} from '../utils/chorePlanRequirements';

const knex = Knex(knexConfig[getConfig().Environment]);

interface ChorePlanSignupRow extends ChorePlanRequirementColumns {
  id: number;
  status: ChorePlanStatus;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  chorePlanID: number;
  userID: number;
  reason: string;
}

interface ShiftSignupRow {
  shiftID: number;
  plannerKey: string | null;
}

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

    const chorePlan = await knex<ChorePlanSignupRow>('chore_plans')
      .select(
        'id',
        'status',
        'choreRequirement',
        'eventRequirement',
        'dinnerRequirement',
      )
      .where('rosterID', rosterID)
      .first();
    if (chorePlan) {
      tmpResponse.choreSignupsOpen = chorePlan.status === 'open';
      const requirementOverride = await knex<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
          'reason',
        )
        .where({ chorePlanID: chorePlan.id, userID })
        .first();
      tmpResponse.requirements = effectiveRequirements(
        requirementsFromColumns(chorePlan),
        requirementOverride
          ? requirementsFromColumns(requirementOverride)
          : null,
      );
      tmpResponse.hasCustomRequirements = Boolean(requirementOverride);
      tmpResponse.requirementExceptionReason =
        requirementOverride?.reason ?? null;
      const signupRows = await knex<ShiftSignupRow>('shift_participants')
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select('shifts.id as shiftID', 'schedules.plannerKey')
        .where('shift_participants.userID', userID)
        .where('schedules.rosterID', rosterID)
        .where('schedules.chorePlanID', chorePlan.id);
      const shiftIDsByKind = {
        chore: new Set<number>(),
        event: new Set<number>(),
        dinner: new Set<number>(),
      };
      signupRows.forEach((signup) => {
        const kind = String(signup.plannerKey ?? '').split('|')[0];
        if (kind === 'chore' || kind === 'event' || kind === 'dinner') {
          shiftIDsByKind[kind].add(Number(signup.shiftID));
        }
      });
      tmpResponse.choreShiftCount = shiftIDsByKind.chore.size;
      tmpResponse.eventShiftCount = shiftIDsByKind.event.size;
      tmpResponse.dinnerShiftCount = shiftIDsByKind.dinner.size;
      tmpResponse.shiftCount =
        tmpResponse.choreShiftCount +
        tmpResponse.eventShiftCount +
        tmpResponse.dinnerShiftCount;
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
