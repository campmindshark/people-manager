import { Knex } from 'knex';
import RosterParticipant from '../models/roster_participant/roster_participant';
import {
  requirementsFromColumns,
  ChorePlanRequirementColumns,
} from '../utils/chorePlanRequirements';

const ROSTER_REMOVAL_REQUIREMENT_CLEAR_REASON = 'Roster membership ended.';

interface ChorePlanRow extends ChorePlanRequirementColumns {
  id: number;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  userID: number;
  reason: string;
}

interface RosterParticipantRow {
  id: number;
  userID: number;
}

export interface RosterParticipantRemovalResult {
  deletedCount: number;
  removedAssignmentCount: number;
}

export default class RosterParticipantController {
  public static async RemoveFromRoster(
    rosterID: number,
    userIDs: number[],
    actorUserID: number,
    database: Knex = RosterParticipant.knex(),
  ): Promise<RosterParticipantRemovalResult> {
    const uniqueUserIDs = [...new Set(userIDs)].sort(
      (first, second) => first - second,
    );
    if (uniqueUserIDs.length === 0) {
      return { deletedCount: 0, removedAssignmentCount: 0 };
    }
    const lockUserIDs = [...new Set([...uniqueUserIDs, actorUserID])].sort(
      (first, second) => first - second,
    );

    return database.transaction(async (transaction) => {
      await transaction('users')
        .select('id')
        .whereIn('id', lockUserIDs)
        .orderBy('id')
        // Lock the audit actor before assignment rows while retaining
        // compatibility with the audit foreign key's FOR KEY SHARE lock.
        .forNoKeyUpdate();
      const participants = (await transaction<RosterParticipantRow>(
        'roster_participants',
      )
        .select('id', 'userID')
        .where('rosterID', rosterID)
        .whereIn('userID', uniqueUserIDs)
        .orderBy('userID')
        .forUpdate()) as RosterParticipantRow[];

      if (participants.length === 0) {
        return { deletedCount: 0, removedAssignmentCount: 0 };
      }

      const participantUserIDs = participants.map(({ userID }) => userID);
      const rosterShiftIDs = transaction('shifts')
        .innerJoin('schedules', 'schedules.id', 'shifts.scheduleID')
        .select('shifts.id')
        .where('schedules.rosterID', rosterID);
      const removedAssignmentCount = await transaction('shift_participants')
        .whereIn('userID', participantUserIDs)
        .whereIn('shiftID', rosterShiftIDs)
        .del();

      const chorePlan = (await transaction<ChorePlanRow>('chore_plans')
        .select(
          'id',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('rosterID', rosterID)
        .first()) as ChorePlanRow | undefined;
      if (chorePlan) {
        const overrides = (await transaction<RequirementOverrideRow>(
          'chore_plan_requirement_overrides',
        )
          .select(
            'userID',
            'choreRequirement',
            'eventRequirement',
            'dinnerRequirement',
            'reason',
          )
          .where('chorePlanID', chorePlan.id)
          .whereIn('userID', participantUserIDs)
          .orderBy('userID')
          .forUpdate()) as RequirementOverrideRow[];
        if (overrides.length > 0) {
          await transaction('chore_plan_requirement_overrides')
            .where('chorePlanID', chorePlan.id)
            .whereIn(
              'userID',
              overrides.map(({ userID }) => userID),
            )
            .del();
          const planRequirements = requirementsFromColumns(chorePlan);
          await transaction('chore_plan_audit_entries').insert(
            overrides.map((override) => ({
              chorePlanID: chorePlan.id,
              actorUserID,
              action: 'participant_requirements_cleared',
              details: {
                participantUserID: override.userID,
                previousRequirements: requirementsFromColumns(
                  override,
                  planRequirements,
                ),
                requirements: planRequirements,
                previousReason: override.reason,
                reason: ROSTER_REMOVAL_REQUIREMENT_CLEAR_REASON,
                removedAssignments: [],
              },
            })),
          );
        }
      }

      const deletedCount = await transaction('roster_participants')
        .whereIn(
          'id',
          participants.map(({ id }) => id),
        )
        .del();

      return { deletedCount, removedAssignmentCount };
    });
  }
}
