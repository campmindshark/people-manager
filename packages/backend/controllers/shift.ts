import Knex, { Knex as KnexInstance } from 'knex';
import knexConfig from '../knexfile';
import GroupController, { ShiftSignupAccess } from './group';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import Schedule from '../models/schedule/schedule';
import ShiftViewModel, {
  SHIFT_SIGNUP_RESTRICTION_MESSAGES,
} from '../view_models/shift';
import {
  ChorePlanKind,
  ChorePlanStatus,
  MAX_CHORE_PLAN_REQUIREMENT,
} from '../view_models/chore_plan';
import { getConfig } from '../config/config';
import ShiftSignupError from '../utils/shiftSignupError';
import {
  shiftTimeRangeContains,
  shiftTimeRangesOverlap,
  ShiftTimeRange,
} from '../utils/shiftTime';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
  requirementsFromColumns,
} from '../utils/chorePlanRequirements';
import ChorePlanAuditController from './chore_plan_audit';

const knex = Knex(knexConfig[getConfig().Environment]);

export interface ShiftSignupResult {
  registeredShiftIDs: number[];
}

export interface ShiftChangeResult {
  unregisteredShiftID: number;
  registeredShiftID: number;
}

export interface ChoreSignupEditResult {
  addedShiftIDs: number[];
  removedShiftIDs: number[];
}

export interface ShiftParticipantAssignment {
  shiftID: number;
  userID: number;
}

export interface ShiftParticipantReassignment {
  userID: number;
  sourceShiftID: number;
  destinationShiftID: number;
}

export interface ShiftReassignmentResult {
  reassignments: ShiftParticipantReassignment[];
  forced: boolean;
}

export interface ShiftAssignmentResult {
  assigned: ShiftParticipantAssignment;
}

export interface ShiftUnassignmentResult {
  unassigned: ShiftParticipantAssignment;
}

interface ShiftSignupRow extends ShiftTimeRange {
  id: number;
  chorePlanID: number | null;
  requiredParticipants: number;
  rosterID: number;
}

interface ChorePlanSignupRow {
  id: number;
  status: ChorePlanStatus;
}

interface ChorePlanShiftSignupRow
  extends ShiftTimeRange, ChorePlanRequirementColumns {
  id: number;
  requiredParticipants: number;
  chorePlanID: number;
  rosterID: number;
  plannerKey: string | null;
  status: ChorePlanStatus;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  chorePlanID: number;
  userID: number;
}

interface PlanRequirementRow extends ChorePlanRequirementColumns {
  id: number;
}

interface ExistingChoreSignupRow extends ShiftTimeRange {
  shiftID: number;
  chorePlanID: number | null;
  plannerKey: string | null;
}

interface ExistingSignupRow extends ShiftTimeRange {
  shiftID: number;
}

interface RosterAttendanceWindowRow {
  rosterID: number;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

interface ShiftParticipantRow {
  id: number;
  shiftID: number;
  userID: number;
}

interface AdminReassignmentShiftRow extends ShiftTimeRange {
  id: number;
  requiredParticipants: number;
  chorePlanID: number | null;
  rosterID: number;
  plannerKey: string | null;
  scheduleName: string;
}

interface AdminReassignmentUserRow {
  id: number;
  firstName: string;
  lastName: string;
}

interface AdminExistingSignupRow extends ShiftTimeRange {
  shiftID: number;
  userID: number;
  chorePlanID: number | null;
  rosterID: number;
  plannerKey: string | null;
}

interface AdminRosterParticipantRow {
  userID: number;
  rosterID: number;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

function chorePlanKind(plannerKey: string | null): ChorePlanKind | null {
  if (!plannerKey) {
    return null;
  }
  const kind = plannerKey.split('|')[0];
  if (kind === 'chore' || kind === 'event' || kind === 'dinner') {
    return kind;
  }
  return null;
}

function shiftSignupAccessMessage(access: ShiftSignupAccess): string {
  return access.hasGroup
    ? SHIFT_SIGNUP_RESTRICTION_MESSAGES.prioritySignupNotOpen
    : SHIFT_SIGNUP_RESTRICTION_MESSAGES.signupGroupRequired;
}

async function requireShiftSignupAccess(
  userID: number,
  rosterID: number,
  database: KnexInstance,
): Promise<void> {
  // This gate intentionally applies only to legacy shifts. To restore group
  // waves for chore plans, enforce it in the chore add/remove/change methods
  // and include group access in the chore-plan `signupOpen` read model below.
  const access = await GroupController.GetShiftSignupAccessForUser(
    userID,
    rosterID,
    database,
  );
  if (!access.signupOpen) {
    throw new ShiftSignupError(shiftSignupAccessMessage(access), 403);
  }
}

export default class ShiftController {
  public static async GetShiftsByParticipantIDandRoster(
    participantID: number,
    rosterID: number,
  ): Promise<Shift[]> {
    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', participantID)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
      .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
      .where('rosterID', rosterID);

    const shifts = await query;

    return shifts;
  }

  public static async GetShiftViewModelsByParticipantID(
    participantID: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', participantID)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id');

    const shifts = await query;

    const shiftViewModels =
      await ShiftController.loadViewModelsFromShifts(shifts);
    return shiftViewModels;
  }

  public static async GetShiftViewModelsByScheduleID(
    scheduleID: number,
    userID?: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .where('scheduleID', scheduleID)
      .orderBy('startTime', 'asc');

    const shifts = await query;

    const shiftViewModels = await ShiftController.loadViewModelsFromShifts(
      shifts,
      userID,
    );
    return shiftViewModels;
  }

  public static async ReassignShiftParticipants(
    reassignments: ShiftParticipantReassignment[],
    actorUserID: number,
    force = false,
  ): Promise<ShiftReassignmentResult> {
    if (
      (reassignments.length !== 1 && reassignments.length !== 2) ||
      reassignments.some(
        ({ userID, sourceShiftID, destinationShiftID }) =>
          !Number.isInteger(userID) ||
          userID < 1 ||
          !Number.isInteger(sourceShiftID) ||
          sourceShiftID < 1 ||
          !Number.isInteger(destinationShiftID) ||
          destinationShiftID < 1 ||
          sourceShiftID === destinationShiftID,
      )
    ) {
      throw new ShiftSignupError(
        'Choose valid people and distinct source and destination shifts.',
        400,
      );
    }

    if (reassignments.length === 2) {
      const [first, second] = reassignments;
      if (
        first.userID === second.userID ||
        first.sourceShiftID === second.sourceShiftID ||
        first.destinationShiftID !== second.sourceShiftID ||
        second.destinationShiftID !== first.sourceShiftID
      ) {
        throw new ShiftSignupError(
          'Select two different people from two different shifts to swap.',
          400,
        );
      }
    }

    return knex.transaction(async (transaction) => {
      const userIDs = [
        ...new Set(reassignments.map(({ userID }) => userID)),
      ].sort((first, second) => first - second);
      const shiftIDs = [
        ...new Set(
          reassignments.flatMap(({ sourceShiftID, destinationShiftID }) => [
            sourceShiftID,
            destinationShiftID,
          ]),
        ),
      ].sort((first, second) => first - second);

      const users = await transaction<AdminReassignmentUserRow>('users')
        .select('id', 'firstName', 'lastName')
        .whereIn('id', userIDs)
        .orderBy('id')
        .forUpdate();
      if (users.length !== userIDs.length) {
        throw new ShiftSignupError(
          'One or more selected people were not found.',
          404,
        );
      }

      const shifts = await transaction<AdminReassignmentShiftRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'schedules.name as scheduleName',
        )
        .whereIn('shifts.id', shiftIDs)
        .orderBy('shifts.id')
        .forUpdate('shifts');
      if (shifts.length !== shiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected shifts were not found.',
          404,
        );
      }

      const existingParticipantRows = await transaction<ShiftParticipantRow>(
        'shift_participants',
      )
        .select('id', 'shiftID', 'userID')
        .whereIn('userID', userIDs)
        .orderBy('id')
        .forUpdate();
      const sourceAssignmentExists = reassignments.every((reassignment) =>
        existingParticipantRows.some(
          (participant) =>
            Number(participant.userID) === reassignment.userID &&
            Number(participant.shiftID) === reassignment.sourceShiftID,
        ),
      );
      if (!sourceAssignmentExists) {
        throw new ShiftSignupError(
          'A selected person is no longer assigned to the source shift. Refresh and try again.',
          409,
        );
      }

      const destinationAssignmentExists = reassignments.some((reassignment) =>
        existingParticipantRows.some(
          (participant) =>
            Number(participant.userID) === reassignment.userID &&
            Number(participant.shiftID) === reassignment.destinationShiftID,
        ),
      );
      if (destinationAssignmentExists) {
        throw new ShiftSignupError(
          'A selected person is already assigned to the destination shift.',
          409,
        );
      }

      const shiftByID = new Map(
        shifts.map((shift) => [Number(shift.id), shift]),
      );

      if (!force) {
        const rosterIDs = new Set(shifts.map((shift) => shift.rosterID));
        if (rosterIDs.size !== 1) {
          throw new ShiftSignupError(
            'Safe reassignments must stay within one roster.',
            409,
          );
        }

        const selectedChorePlanIDs = new Set(
          shifts.map((shift) => shift.chorePlanID),
        );
        const kinds = new Set(
          shifts.map((shift) => chorePlanKind(shift.plannerKey)),
        );
        if (
          selectedChorePlanIDs.size !== 1 ||
          selectedChorePlanIDs.has(null) ||
          kinds.has(null)
        ) {
          throw new ShiftSignupError(
            'Safe reassignments must stay within one chore plan and use generated signup shifts.',
            409,
          );
        }

        const participantCounts = await transaction('shift_participants')
          .select('shiftID')
          .count('* as participantCount')
          .whereIn('shiftID', shiftIDs)
          .groupBy('shiftID');
        const finalCountByShiftID = new Map(
          shifts.map((shift) => [Number(shift.id), 0]),
        );
        participantCounts.forEach((row) => {
          finalCountByShiftID.set(
            Number(row.shiftID),
            Number(row.participantCount),
          );
        });
        reassignments.forEach(({ sourceShiftID, destinationShiftID }) => {
          finalCountByShiftID.set(
            sourceShiftID,
            (finalCountByShiftID.get(sourceShiftID) ?? 0) - 1,
          );
          finalCountByShiftID.set(
            destinationShiftID,
            (finalCountByShiftID.get(destinationShiftID) ?? 0) + 1,
          );
        });
        const overCapacityShift = shifts.find(
          (shift) =>
            (finalCountByShiftID.get(Number(shift.id)) ?? 0) >
            Number(shift.requiredParticipants),
        );
        if (overCapacityShift) {
          throw new ShiftSignupError(
            'The reassignment would put a shift over capacity.',
            409,
          );
        }

        const destinationRosterIDs = [
          ...new Set(
            reassignments.map(({ destinationShiftID }) => {
              const destinationShift = shiftByID.get(destinationShiftID);
              if (!destinationShift) {
                throw new ShiftSignupError('Destination shift not found.', 404);
              }
              return destinationShift.rosterID;
            }),
          ),
        ];
        const rosterParticipants = await transaction<AdminRosterParticipantRow>(
          'roster_participants',
        )
          .select(
            'userID',
            'rosterID',
            'estimatedArrivalDate',
            'estimatedDepartureDate',
          )
          .whereIn('userID', userIDs)
          .whereIn('rosterID', destinationRosterIDs);
        const rosterParticipantByUserAndRoster = new Map(
          rosterParticipants.map((participant) => [
            `${Number(participant.userID)}|${Number(participant.rosterID)}`,
            participant,
          ]),
        );
        reassignments.forEach(({ userID, destinationShiftID }) => {
          const destinationShift = shiftByID.get(destinationShiftID);
          if (!destinationShift) {
            throw new ShiftSignupError('Destination shift not found.', 404);
          }
          const rosterParticipant = rosterParticipantByUserAndRoster.get(
            `${userID}|${destinationShift.rosterID}`,
          );
          if (!rosterParticipant) {
            throw new ShiftSignupError(
              'Each selected person must be signed up for the destination roster.',
              409,
            );
          }
          if (
            !shiftTimeRangeContains(
              {
                startTime: rosterParticipant.estimatedArrivalDate,
                endTime: rosterParticipant.estimatedDepartureDate,
              },
              destinationShift,
            )
          ) {
            throw new ShiftSignupError(
              "A destination shift falls outside a selected person's attendance dates.",
              409,
            );
          }
        });

        const existingSignups = await transaction<AdminExistingSignupRow>(
          'shift_participants',
        )
          .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
          .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
          .select(
            'shift_participants.shiftID',
            'shift_participants.userID',
            'shifts.startTime',
            'shifts.endTime',
            'schedules.chorePlanID',
            'schedules.rosterID',
            'schedules.plannerKey',
          )
          .whereIn('shift_participants.userID', userIDs);

        const chorePlanIDs = [
          ...new Set(
            [...existingSignups, ...shifts].flatMap((shift) =>
              shift.chorePlanID ? [Number(shift.chorePlanID)] : [],
            ),
          ),
        ];
        const planRequirementRows = chorePlanIDs.length
          ? await transaction<PlanRequirementRow>('chore_plans')
              .select(
                'id',
                'choreRequirement',
                'eventRequirement',
                'dinnerRequirement',
              )
              .whereIn('id', chorePlanIDs)
          : [];
        const requirementOverrideRows = chorePlanIDs.length
          ? await transaction<RequirementOverrideRow>(
              'chore_plan_requirement_overrides',
            )
              .select(
                'chorePlanID',
                'userID',
                'choreRequirement',
                'eventRequirement',
                'dinnerRequirement',
              )
              .whereIn('chorePlanID', chorePlanIDs)
              .whereIn('userID', userIDs)
          : [];
        const planRequirementsByID = new Map(
          planRequirementRows.map((plan) => [
            Number(plan.id),
            requirementsFromColumns(plan),
          ]),
        );
        const requirementOverridesByUserAndPlan = new Map(
          requirementOverrideRows.map((override) => [
            `${override.userID}|${override.chorePlanID}`,
            requirementsFromColumns(override),
          ]),
        );

        userIDs.forEach((userID) => {
          const userReassignments = reassignments.filter(
            (reassignment) => reassignment.userID === userID,
          );
          const sourceShiftIDs = new Set(
            userReassignments.map(({ sourceShiftID }) => sourceShiftID),
          );
          const finalSignups = [
            ...existingSignups.filter(
              (signup) =>
                Number(signup.userID) === userID &&
                !sourceShiftIDs.has(Number(signup.shiftID)),
            ),
            ...userReassignments.map(({ destinationShiftID }) => {
              const destinationShift = shiftByID.get(destinationShiftID);
              if (!destinationShift) {
                throw new ShiftSignupError('Destination shift not found.', 404);
              }
              return {
                ...destinationShift,
                shiftID: destinationShift.id,
                userID,
              };
            }),
          ];
          const hasTimeConflict = finalSignups.some((signup, index) =>
            finalSignups
              .slice(index + 1)
              .some((otherSignup) =>
                shiftTimeRangesOverlap(signup, otherSignup),
              ),
          );
          if (hasTimeConflict) {
            throw new ShiftSignupError(
              'The reassignment would create a time conflict for a selected person.',
              409,
            );
          }

          const signupCountByPlanAndKind = new Map<string, number>();
          finalSignups.forEach((signup) => {
            const kind = chorePlanKind(signup.plannerKey);
            if (signup.chorePlanID && kind) {
              const key = `${signup.chorePlanID}|${kind}`;
              signupCountByPlanAndKind.set(
                key,
                (signupCountByPlanAndKind.get(key) ?? 0) + 1,
              );
            }
          });
          const exceedsSignupRequirement = [
            ...signupCountByPlanAndKind.entries(),
          ].some(([key, count]) => {
            const [chorePlanIDValue, kindValue] = key.split('|');
            const chorePlanID = Number(chorePlanIDValue);
            const kind = kindValue as ChorePlanKind;
            const planRequirements = planRequirementsByID.get(chorePlanID);
            if (!planRequirements) {
              return true;
            }
            const customRequirements = requirementOverridesByUserAndPlan.get(
              `${userID}|${chorePlanID}`,
            );
            return (
              count >
              effectiveRequirements(planRequirements, customRequirements)[kind]
            );
          });
          if (exceedsSignupRequirement) {
            throw new ShiftSignupError(
              'The reassignment would exceed a category signup requirement.',
              409,
            );
          }
        });
      }

      await Promise.all(
        reassignments.map(async (reassignment) => {
          const updatedCount = await transaction('shift_participants')
            .where({
              shiftID: reassignment.sourceShiftID,
              userID: reassignment.userID,
            })
            .update({ shiftID: reassignment.destinationShiftID });
          if (updatedCount !== 1) {
            throw new ShiftSignupError(
              'An assignment changed while this request was being saved. Refresh and try again.',
              409,
            );
          }
        }),
      );

      const chorePlanIDs = [
        ...new Set(
          shifts
            .map((shift) => shift.chorePlanID)
            .filter((planID): planID is number => planID !== null),
        ),
      ];
      const auditReassignments = reassignments.map((reassignment) => {
        const user = users.find(
          (candidate) => Number(candidate.id) === reassignment.userID,
        );
        const sourceShift = shiftByID.get(reassignment.sourceShiftID);
        const destinationShift = shiftByID.get(reassignment.destinationShiftID);
        if (!user || !sourceShift || !destinationShift) {
          throw new Error('Audit details could not be created.');
        }
        return {
          userID: reassignment.userID,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          sourceShift: {
            id: sourceShift.id,
            scheduleName: sourceShift.scheduleName,
            startTime: new Date(sourceShift.startTime).toISOString(),
          },
          destinationShift: {
            id: destinationShift.id,
            scheduleName: destinationShift.scheduleName,
            startTime: new Date(destinationShift.startTime).toISOString(),
          },
        };
      });
      await Promise.all(
        chorePlanIDs.map((chorePlanID) =>
          ChorePlanAuditController.Record(
            transaction,
            chorePlanID,
            actorUserID,
            'shift_participants_reassigned',
            { forced: force, reassignments: auditReassignments },
          ),
        ),
      );

      return { reassignments, forced: force };
    });
  }

  public static async AssignShiftParticipant(
    assignment: ShiftParticipantAssignment,
    actorUserID: number,
  ): Promise<ShiftAssignmentResult> {
    const { shiftID, userID } = assignment;
    if (
      !Number.isInteger(shiftID) ||
      shiftID < 1 ||
      !Number.isInteger(userID) ||
      userID < 1
    ) {
      throw new ShiftSignupError(
        'Choose a valid person and destination shift to assign.',
        400,
      );
    }

    return knex.transaction(async (transaction) => {
      const user = await transaction<AdminReassignmentUserRow>('users')
        .select('id', 'firstName', 'lastName')
        .where('id', userID)
        .first()
        .forUpdate();
      if (!user) {
        throw new ShiftSignupError('The selected person was not found.', 404);
      }

      const shift = await transaction<AdminReassignmentShiftRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'schedules.name as scheduleName',
        )
        .where('shifts.id', shiftID)
        .first()
        .forUpdate('shifts');
      if (!shift) {
        throw new ShiftSignupError('The selected shift was not found.', 404);
      }
      const kind = chorePlanKind(shift.plannerKey);
      if (!shift.chorePlanID || !kind) {
        throw new ShiftSignupError(
          'Admin assignment is only available for generated chore-plan shifts.',
          409,
        );
      }

      const rosterParticipant = await transaction<AdminRosterParticipantRow>(
        'roster_participants',
      )
        .select(
          'userID',
          'rosterID',
          'estimatedArrivalDate',
          'estimatedDepartureDate',
        )
        .where({ rosterID: shift.rosterID, userID })
        .first();
      if (!rosterParticipant) {
        throw new ShiftSignupError(
          'The selected person is not signed up for this roster.',
          409,
        );
      }
      if (
        !shiftTimeRangeContains(
          {
            startTime: rosterParticipant.estimatedArrivalDate,
            endTime: rosterParticipant.estimatedDepartureDate,
          },
          shift,
        )
      ) {
        throw new ShiftSignupError(
          "The shift falls outside the selected person's attendance dates.",
          409,
        );
      }

      await transaction('shift_participants')
        .select('id')
        .where('userID', userID)
        .orderBy('id')
        .forUpdate();
      const existingSignups = await transaction<AdminExistingSignupRow>(
        'shift_participants',
      )
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shift_participants.shiftID',
          'shift_participants.userID',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
        )
        .where('shift_participants.userID', userID);
      if (
        existingSignups.some(
          (signup) => Number(signup.shiftID) === Number(shiftID),
        )
      ) {
        throw new ShiftSignupError(
          'The selected person is already assigned to this shift.',
          409,
        );
      }
      if (
        existingSignups.some((signup) => shiftTimeRangesOverlap(shift, signup))
      ) {
        throw new ShiftSignupError(
          'The assignment would create a time conflict for the selected person.',
          409,
        );
      }

      const planRequirements = await transaction<PlanRequirementRow>(
        'chore_plans',
      )
        .select(
          'id',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where('id', shift.chorePlanID)
        .first();
      if (!planRequirements) {
        throw new ShiftSignupError('The chore plan was not found.', 404);
      }
      const requirementOverride = await transaction<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'chorePlanID',
          'userID',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where({ chorePlanID: shift.chorePlanID, userID })
        .first();
      const requirement = effectiveRequirements(
        requirementsFromColumns(planRequirements),
        requirementOverride
          ? requirementsFromColumns(requirementOverride)
          : null,
      )[kind];
      const categorySignupCount = new Set(
        existingSignups
          .filter(
            (signup) =>
              Number(signup.chorePlanID) === Number(shift.chorePlanID) &&
              chorePlanKind(signup.plannerKey) === kind,
          )
          .map((signup) => Number(signup.shiftID)),
      ).size;
      if (categorySignupCount >= requirement) {
        throw new ShiftSignupError(
          `The selected person already has all required ${kind} shifts.`,
          409,
        );
      }

      const participantCount = await transaction('shift_participants')
        .where('shiftID', shiftID)
        .count('* as count')
        .first();
      if (
        Number(participantCount?.count ?? 0) >=
        Number(shift.requiredParticipants)
      ) {
        throw new ShiftSignupError(
          'The selected shift is already full. Refresh and choose another open spot.',
          409,
        );
      }

      await transaction('shift_participants').insert({ shiftID, userID });
      await ChorePlanAuditController.Record(
        transaction,
        shift.chorePlanID,
        actorUserID,
        'shift_participant_assigned',
        {
          assignment: {
            userID,
            userName: `${user.firstName} ${user.lastName}`.trim(),
            destinationShift: {
              id: shift.id,
              scheduleName: shift.scheduleName,
              startTime: new Date(shift.startTime).toISOString(),
            },
          },
        },
      );

      return { assigned: assignment };
    });
  }

  public static async UnassignShiftParticipant(
    assignment: ShiftParticipantAssignment,
    actorUserID: number,
  ): Promise<ShiftUnassignmentResult> {
    const { shiftID, userID } = assignment;
    if (
      !Number.isInteger(shiftID) ||
      shiftID < 1 ||
      !Number.isInteger(userID) ||
      userID < 1
    ) {
      throw new ShiftSignupError(
        'Choose a valid person and source shift to unassign.',
        400,
      );
    }

    return knex.transaction(async (transaction) => {
      const user = await transaction<AdminReassignmentUserRow>('users')
        .select('id', 'firstName', 'lastName')
        .where('id', userID)
        .first()
        .forUpdate();
      if (!user) {
        throw new ShiftSignupError('The selected person was not found.', 404);
      }

      const shift = await transaction<AdminReassignmentShiftRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'schedules.name as scheduleName',
        )
        .where('shifts.id', shiftID)
        .first()
        .forUpdate('shifts');
      if (!shift) {
        throw new ShiftSignupError('The selected shift was not found.', 404);
      }
      if (!shift.chorePlanID || !chorePlanKind(shift.plannerKey)) {
        throw new ShiftSignupError(
          'Admin unassignment is only available for generated chore-plan shifts.',
          409,
        );
      }

      const participant = await transaction<ShiftParticipantRow>(
        'shift_participants',
      )
        .select('id', 'shiftID', 'userID')
        .where({ shiftID, userID })
        .first()
        .forUpdate();
      if (!participant) {
        throw new ShiftSignupError(
          'The selected person is no longer assigned to that shift. Refresh and try again.',
          409,
        );
      }

      const deletedCount = await transaction('shift_participants')
        .where('id', participant.id)
        .del();
      if (deletedCount !== 1) {
        throw new ShiftSignupError(
          'The assignment changed while this request was being saved. Refresh and try again.',
          409,
        );
      }

      await ChorePlanAuditController.Record(
        transaction,
        shift.chorePlanID,
        actorUserID,
        'shift_participant_unassigned',
        {
          unassignment: {
            userID,
            userName: `${user.firstName} ${user.lastName}`.trim(),
            sourceShift: {
              id: shift.id,
              scheduleName: shift.scheduleName,
              startTime: new Date(shift.startTime).toISOString(),
            },
          },
        },
      );

      return { unassigned: assignment };
    });
  }

  public static async UnregisterParticipantFromShift(
    shiftID: number,
    userID: number,
  ): Promise<boolean> {
    const shift = await knex('shifts')
      .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
      .select('schedules.chorePlanID')
      .where('shifts.id', shiftID)
      .first();
    if (!shift) {
      throw new ShiftSignupError('Shift not found.', 404);
    }

    if (shift.chorePlanID) {
      await ShiftController.EditParticipantChorePlanSignups(
        [],
        [shiftID],
        userID,
      );
      return true;
    }

    await knex('shift_participants').where({ shiftID, userID }).del();

    return true;
  }

  public static async EditParticipantChorePlanSignups(
    requestedAddShiftIDs: number[],
    requestedRemoveShiftIDs: number[],
    userID: number,
  ): Promise<ChoreSignupEditResult> {
    const addShiftIDs = [...new Set(requestedAddShiftIDs)];
    const removeShiftIDs = [...new Set(requestedRemoveShiftIDs)];
    const invalidRequest =
      addShiftIDs.length !== requestedAddShiftIDs.length ||
      removeShiftIDs.length !== requestedRemoveShiftIDs.length ||
      addShiftIDs.length + removeShiftIDs.length === 0 ||
      addShiftIDs.length > MAX_CHORE_PLAN_REQUIREMENT ||
      removeShiftIDs.length > MAX_CHORE_PLAN_REQUIREMENT ||
      [...addShiftIDs, ...removeShiftIDs].some(
        (shiftID) => !Number.isInteger(shiftID) || shiftID < 1,
      ) ||
      addShiftIDs.some((shiftID) => removeShiftIDs.includes(shiftID));
    if (invalidRequest) {
      throw new ShiftSignupError(
        `Add or remove between one and ${MAX_CHORE_PLAN_REQUIREMENT} distinct chore-plan shifts.`,
        400,
      );
    }

    if (removeShiftIDs.length === 0) {
      const result =
        await ShiftController.RegisterParticipantForChorePlanShifts(
          addShiftIDs,
          userID,
        );
      return {
        addedShiftIDs: result.registeredShiftIDs,
        removedShiftIDs: [],
      };
    }

    if (addShiftIDs.length > 0) {
      if (addShiftIDs.length !== 1 || removeShiftIDs.length !== 1) {
        throw new ShiftSignupError(
          'Replace one chore-plan shift at a time.',
          400,
        );
      }
      const result = await ShiftController.ChangeParticipantChorePlanShift(
        removeShiftIDs[0],
        addShiftIDs[0],
        userID,
      );
      return {
        addedShiftIDs: [result.registeredShiftID],
        removedShiftIDs: [result.unregisteredShiftID],
      };
    }

    return knex.transaction(async (transaction) => {
      await transaction('users').where('id', userID).forUpdate().first();

      const shifts = await transaction<ChorePlanShiftSignupRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .join('chore_plans', 'schedules.chorePlanID', '=', 'chore_plans.id')
        .select(
          'shifts.id',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'chore_plans.status',
        )
        .whereIn('shifts.id', removeShiftIDs)
        .orderBy('shifts.id')
        .forUpdate();
      if (shifts.length !== removeShiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected chore-plan shifts were not found.',
          404,
        );
      }

      const planIDs = new Set(shifts.map((shift) => shift.chorePlanID));
      const rosterIDs = new Set(shifts.map((shift) => shift.rosterID));
      const kinds = new Set(
        shifts.map((shift) => chorePlanKind(shift.plannerKey)),
      );
      if (
        planIDs.size !== 1 ||
        rosterIDs.size !== 1 ||
        kinds.size !== 1 ||
        kinds.has(null)
      ) {
        throw new ShiftSignupError(
          'Remove shifts from one signup table at a time.',
          400,
        );
      }
      if (shifts.some((shift) => shift.status !== 'open')) {
        throw new ShiftSignupError(
          'Signup for this chore plan is not open.',
          409,
        );
      }

      const assignments = await transaction<ShiftParticipantRow>(
        'shift_participants',
      )
        .select('id', 'shiftID', 'userID')
        .where('userID', userID)
        .whereIn('shiftID', removeShiftIDs)
        .orderBy('id')
        .forUpdate();
      if (assignments.length !== removeShiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected signups changed while this request was being saved. Refresh and try again.',
          409,
        );
      }

      const removedCount = await transaction('shift_participants')
        .where('userID', userID)
        .whereIn('shiftID', removeShiftIDs)
        .del();
      if (removedCount !== removeShiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected signups changed while this request was being saved. Refresh and try again.',
          409,
        );
      }

      return { addedShiftIDs: [], removedShiftIDs: removeShiftIDs };
    });
  }

  public static async RegisterParticipantForShift(
    shiftID: number,
    userID: number,
  ): Promise<ShiftSignupResult> {
    const shift = await knex<ShiftSignupRow>('shifts')
      .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
      .select(
        'shifts.id',
        'shifts.requiredParticipants',
        'schedules.chorePlanID',
        'schedules.rosterID',
      )
      .where('shifts.id', shiftID)
      .first();
    if (!shift) {
      throw new ShiftSignupError('Shift not found.', 404);
    }

    if (shift.chorePlanID) {
      return ShiftController.RegisterParticipantForChorePlanShifts(
        [shiftID],
        userID,
      );
    }

    return knex.transaction(async (transaction) => {
      await transaction('users').where('id', userID).forUpdate().first();
      await requireShiftSignupAccess(userID, shift.rosterID, transaction);

      const lockedShift = await transaction<ShiftSignupRow>('shifts')
        .select('id', 'requiredParticipants', 'startTime', 'endTime')
        .where('id', shiftID)
        .forUpdate()
        .first();
      if (!lockedShift) {
        throw new ShiftSignupError('Shift not found.', 404);
      }
      const existingSignup = await transaction('shift_participants')
        .where({ shiftID, userID })
        .first();
      if (existingSignup) {
        return { registeredShiftIDs: [] };
      }

      const existingShifts = await transaction<ShiftTimeRange>(
        'shift_participants',
      )
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .select('shifts.startTime', 'shifts.endTime')
        .where('shift_participants.userID', userID);
      if (
        existingShifts.some((existingShift) =>
          shiftTimeRangesOverlap(lockedShift, existingShift),
        )
      ) {
        throw new ShiftSignupError(
          'You are already signed up for another shift during this time block.',
          409,
        );
      }

      const participantCount = await transaction('shift_participants')
        .where('shiftID', shiftID)
        .count('* as count')
        .first();
      if (
        Number(participantCount?.count ?? 0) >=
        Number(lockedShift.requiredParticipants)
      ) {
        throw new ShiftSignupError('This shift is already full.', 409);
      }

      await transaction('shift_participants').insert({ shiftID, userID });
      return { registeredShiftIDs: [shiftID] };
    });
  }

  public static async RegisterParticipantForChorePlanShifts(
    requestedShiftIDs: number[],
    userID: number,
  ): Promise<ShiftSignupResult> {
    const shiftIDs = [...new Set(requestedShiftIDs)];
    if (
      shiftIDs.length === 0 ||
      shiftIDs.length !== requestedShiftIDs.length ||
      shiftIDs.length > MAX_CHORE_PLAN_REQUIREMENT ||
      shiftIDs.some((shiftID) => !Number.isInteger(shiftID) || shiftID < 1)
    ) {
      throw new ShiftSignupError(
        `Select between one and ${MAX_CHORE_PLAN_REQUIREMENT} distinct shifts.`,
        400,
      );
    }

    return knex.transaction(async (transaction) => {
      await transaction('users').where('id', userID).forUpdate().first();

      const shifts = await transaction<ChorePlanShiftSignupRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .join('chore_plans', 'schedules.chorePlanID', '=', 'chore_plans.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'chore_plans.status',
          'chore_plans.choreRequirement',
          'chore_plans.eventRequirement',
          'chore_plans.dinnerRequirement',
        )
        .whereIn('shifts.id', shiftIDs)
        .orderBy('shifts.id')
        .forUpdate();
      if (shifts.length !== shiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected chore-plan shifts were not found.',
          404,
        );
      }

      const planIDs = new Set(shifts.map((shift) => shift.chorePlanID));
      const kinds = new Set(
        shifts.map((shift) => chorePlanKind(shift.plannerKey)),
      );
      if (planIDs.size !== 1 || kinds.size !== 1 || kinds.has(null)) {
        throw new ShiftSignupError(
          'Confirm shifts from one signup table at a time.',
          400,
        );
      }
      const kind = [...kinds][0] as ChorePlanKind;
      const { chorePlanID } = shifts[0];
      const requirementOverride = await transaction<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .select(
          'chorePlanID',
          'userID',
          'choreRequirement',
          'eventRequirement',
          'dinnerRequirement',
        )
        .where({ chorePlanID, userID })
        .first();
      const signupLimit = effectiveRequirements(
        requirementsFromColumns(shifts[0]),
        requirementOverride
          ? requirementsFromColumns(requirementOverride)
          : null,
      )[kind];
      if (signupLimit === 0) {
        throw new ShiftSignupError(
          `You are exempt from ${kind} shifts for this chore plan.`,
          409,
        );
      }
      if (shiftIDs.length > signupLimit) {
        throw new ShiftSignupError(
          `You can select up to ${signupLimit} ${kind} shift${
            signupLimit === 1 ? '' : 's'
          }.`,
          400,
        );
      }
      if (shifts.some((shift) => shift.status !== 'open')) {
        throw new ShiftSignupError(
          'Signup for this chore plan is not open.',
          409,
        );
      }

      const { rosterID } = shifts[0];
      const rosterParticipant = await transaction('roster_participants')
        .where({ rosterID, userID })
        .first();
      if (!rosterParticipant) {
        throw new ShiftSignupError(
          SHIFT_SIGNUP_RESTRICTION_MESSAGES.rosterSignupRequired,
          403,
        );
      }
      const existingSignups = await transaction<ExistingChoreSignupRow>(
        'shift_participants',
      )
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shift_participants.shiftID',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.plannerKey',
        )
        .where('shift_participants.userID', userID);
      const existingCategoryShiftIDs = new Set(
        existingSignups
          .filter(
            (signup) =>
              Number(signup.chorePlanID) === Number(chorePlanID) &&
              chorePlanKind(signup.plannerKey) === kind,
          )
          .map((signup) => Number(signup.shiftID)),
      );
      const newShiftIDs = shiftIDs.filter(
        (shiftID) => !existingCategoryShiftIDs.has(shiftID),
      );
      if (existingCategoryShiftIDs.size + newShiftIDs.length > signupLimit) {
        throw new ShiftSignupError(
          `You can be signed up for at most ${signupLimit} ${kind} shift${
            signupLimit === 1 ? '' : 's'
          }.`,
          409,
        );
      }

      if (newShiftIDs.length > 0) {
        const newShifts = shifts.filter((shift) =>
          newShiftIDs.includes(Number(shift.id)),
        );
        const attendanceWindow: ShiftTimeRange = {
          startTime: rosterParticipant.estimatedArrivalDate,
          endTime: rosterParticipant.estimatedDepartureDate,
        };
        if (
          newShifts.some(
            (shift) => !shiftTimeRangeContains(attendanceWindow, shift),
          )
        ) {
          throw new ShiftSignupError(
            SHIFT_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow,
            409,
          );
        }
        const selectedShiftsOverlap = newShifts.some((shift, index) =>
          newShifts
            .slice(index + 1)
            .some((otherShift) => shiftTimeRangesOverlap(shift, otherShift)),
        );
        const existingShiftOverlaps = newShifts.some((shift) =>
          existingSignups.some((existingShift) =>
            shiftTimeRangesOverlap(shift, existingShift),
          ),
        );
        if (selectedShiftsOverlap || existingShiftOverlaps) {
          throw new ShiftSignupError(
            'You can only sign up for one shift in each time block.',
            409,
          );
        }

        const participantCounts = await transaction('shift_participants')
          .select('shiftID')
          .count('* as participantCount')
          .whereIn('shiftID', newShiftIDs)
          .groupBy('shiftID');
        const countByShiftID = new Map(
          participantCounts.map((row) => [
            Number(row.shiftID),
            Number(row.participantCount),
          ]),
        );
        const fullShift = shifts.find(
          (shift) =>
            newShiftIDs.includes(Number(shift.id)) &&
            (countByShiftID.get(Number(shift.id)) ?? 0) >=
              Number(shift.requiredParticipants),
        );
        if (fullShift) {
          throw new ShiftSignupError(
            'One of the selected shifts is already full. Refresh and choose another open spot.',
            409,
          );
        }

        await transaction('shift_participants').insert(
          newShiftIDs.map((shiftID) => ({ shiftID, userID })),
        );
      }

      return { registeredShiftIDs: newShiftIDs };
    });
  }

  public static async ChangeParticipantChorePlanShift(
    currentShiftID: number,
    replacementShiftID: number,
    userID: number,
  ): Promise<ShiftChangeResult> {
    if (
      !Number.isInteger(currentShiftID) ||
      currentShiftID < 1 ||
      !Number.isInteger(replacementShiftID) ||
      replacementShiftID < 1 ||
      currentShiftID === replacementShiftID
    ) {
      throw new ShiftSignupError(
        'Choose two distinct chore shifts to make a change.',
        400,
      );
    }

    return knex.transaction(async (transaction) => {
      await transaction('users').where('id', userID).forUpdate().first();

      const shiftIDs = [currentShiftID, replacementShiftID].sort(
        (first, second) => first - second,
      );
      const shifts = await transaction<ChorePlanShiftSignupRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .join('chore_plans', 'schedules.chorePlanID', '=', 'chore_plans.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.rosterID',
          'schedules.plannerKey',
          'chore_plans.status',
        )
        .whereIn('shifts.id', shiftIDs)
        .orderBy('shifts.id')
        .forUpdate();
      if (shifts.length !== shiftIDs.length) {
        throw new ShiftSignupError(
          'One or more selected chore-plan shifts were not found.',
          404,
        );
      }

      const planIDs = new Set(shifts.map((shift) => shift.chorePlanID));
      const rosterIDs = new Set(shifts.map((shift) => shift.rosterID));
      const kinds = new Set(
        shifts.map((shift) => chorePlanKind(shift.plannerKey)),
      );
      if (
        planIDs.size !== 1 ||
        rosterIDs.size !== 1 ||
        kinds.size !== 1 ||
        kinds.has(null)
      ) {
        throw new ShiftSignupError(
          'Choose a replacement from the same signup table.',
          400,
        );
      }
      if (shifts.some((shift) => shift.status !== 'open')) {
        throw new ShiftSignupError(
          'Signup for this chore plan is not open.',
          409,
        );
      }

      const shiftByID = new Map(
        shifts.map((shift) => [Number(shift.id), shift]),
      );
      const replacementShift = shiftByID.get(replacementShiftID);
      if (!replacementShift) {
        throw new ShiftSignupError('Replacement shift not found.', 404);
      }

      const rosterParticipant = await transaction('roster_participants')
        .where({ rosterID: shifts[0].rosterID, userID })
        .first();
      if (!rosterParticipant) {
        throw new ShiftSignupError(
          SHIFT_SIGNUP_RESTRICTION_MESSAGES.rosterSignupRequired,
          403,
        );
      }
      await transaction('shift_participants')
        .select('id')
        .where('userID', userID)
        .orderBy('id')
        .forUpdate();
      const existingSignups = await transaction<ExistingChoreSignupRow>(
        'shift_participants',
      )
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shift_participants.shiftID',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.chorePlanID',
          'schedules.plannerKey',
        )
        .where('shift_participants.userID', userID);
      const currentSignupExists = existingSignups.some(
        (signup) => Number(signup.shiftID) === currentShiftID,
      );
      if (!currentSignupExists) {
        throw new ShiftSignupError(
          'You are no longer signed up for the shift you selected to change.',
          409,
        );
      }
      const replacementSignupExists = existingSignups.some(
        (signup) => Number(signup.shiftID) === replacementShiftID,
      );
      if (replacementSignupExists) {
        throw new ShiftSignupError(
          'You are already signed up for the replacement shift.',
          409,
        );
      }

      const attendanceWindow: ShiftTimeRange = {
        startTime: rosterParticipant.estimatedArrivalDate,
        endTime: rosterParticipant.estimatedDepartureDate,
      };
      if (!shiftTimeRangeContains(attendanceWindow, replacementShift)) {
        throw new ShiftSignupError(
          SHIFT_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow,
          409,
        );
      }
      const replacementOverlapsExistingShift = existingSignups
        .filter((signup) => Number(signup.shiftID) !== currentShiftID)
        .some((signup) => shiftTimeRangesOverlap(replacementShift, signup));
      if (replacementOverlapsExistingShift) {
        throw new ShiftSignupError(
          'You can only sign up for one shift in each time block.',
          409,
        );
      }

      const participantCount = await transaction('shift_participants')
        .where('shiftID', replacementShiftID)
        .count('* as count')
        .first();
      if (
        Number(participantCount?.count ?? 0) >=
        Number(replacementShift.requiredParticipants)
      ) {
        throw new ShiftSignupError(
          'The replacement shift is already full. Refresh and choose another open spot.',
          409,
        );
      }

      const unregisteredCount = await transaction('shift_participants')
        .where({ shiftID: currentShiftID, userID })
        .del();
      if (unregisteredCount !== 1) {
        throw new ShiftSignupError(
          'Your current shift changed while this request was being saved. Refresh and try again.',
          409,
        );
      }
      await transaction('shift_participants').insert({
        shiftID: replacementShiftID,
        userID,
      });

      return {
        unregisteredShiftID: currentShiftID,
        registeredShiftID: replacementShiftID,
      };
    });
  }

  private static async loadViewModelsFromShifts(
    shifts: Shift[],
    userID?: number,
  ): Promise<ShiftViewModel[]> {
    const scheduleIDs = [
      ...new Set(shifts.map((shift) => Number(shift.scheduleID))),
    ];
    const schedules = scheduleIDs.length
      ? await Schedule.query().whereIn('id', scheduleIDs)
      : [];
    const schedulesByID = new Map(
      schedules.map((schedule) => [Number(schedule.id), schedule]),
    );
    const chorePlanIDs = [
      ...new Set(
        schedules.flatMap((schedule) =>
          schedule.chorePlanID ? [schedule.chorePlanID] : [],
        ),
      ),
    ];
    const chorePlans = chorePlanIDs.length
      ? await knex<ChorePlanSignupRow>('chore_plans')
          .select('id', 'status')
          .whereIn('id', chorePlanIDs)
      : [];
    const statusByPlanID = new Map(
      chorePlans.map((plan) => [Number(plan.id), plan.status]),
    );
    const rosterIDs = [
      ...new Set(schedules.map((schedule) => Number(schedule.rosterID))),
    ];
    const [existingSignups, attendanceWindows] = userID
      ? await Promise.all([
          knex<ExistingSignupRow>('shift_participants')
            .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
            .select(
              'shift_participants.shiftID',
              'shifts.startTime',
              'shifts.endTime',
            )
            .where('shift_participants.userID', userID),
          rosterIDs.length
            ? knex<RosterAttendanceWindowRow>('roster_participants')
                .select(
                  'rosterID',
                  'estimatedArrivalDate',
                  'estimatedDepartureDate',
                )
                .where('userID', userID)
                .whereIn('rosterID', rosterIDs)
            : Promise.resolve([]),
        ])
      : [[], []];
    const attendanceWindowByRosterID = new Map(
      attendanceWindows.map((window) => [Number(window.rosterID), window]),
    );
    const groupGatedRosterIDs = [
      ...new Set(
        schedules
          .filter((schedule) => !schedule.chorePlanID)
          .map((schedule) => Number(schedule.rosterID)),
      ),
    ];
    const shiftSignupAccessByRosterID = new Map<number, ShiftSignupAccess>(
      userID
        ? await Promise.all(
            groupGatedRosterIDs.map(
              async (rosterID): Promise<[number, ShiftSignupAccess]> => [
                rosterID,
                await GroupController.GetShiftSignupAccessForUser(
                  userID,
                  rosterID,
                ),
              ],
            ),
          )
        : [],
    );

    const shiftViewModels: Promise<ShiftViewModel>[] = shifts.map(
      async (shift): Promise<ShiftViewModel> => {
        const participants = (
          await Shift.relatedQuery('participants').for(shift.id)
        ).map((participant) => User.fromJson(participant));
        const schedule = schedulesByID.get(Number(shift.scheduleID));

        if (!schedule) {
          throw new Error('Schedule not found for shift');
        }

        const planSignupOpen =
          !schedule.chorePlanID ||
          statusByPlanID.get(Number(schedule.chorePlanID)) === 'open';
        const shiftSignupAccess = shiftSignupAccessByRosterID.get(
          Number(schedule.rosterID),
        );
        const groupGateOpen =
          Boolean(schedule.chorePlanID) ||
          !userID ||
          shiftSignupAccess?.signupOpen === true;
        let signupRestrictionReason: string | null = null;
        let signupConflictShiftIDs: number[] = [];
        if (userID && planSignupOpen) {
          const currentUserIsSignedUp = participants.some(
            (participant) => Number(participant.id) === Number(userID),
          );
          if (!currentUserIsSignedUp) {
            const attendanceWindow = attendanceWindowByRosterID.get(
              Number(schedule.rosterID),
            );
            if (schedule.chorePlanID && !attendanceWindow) {
              signupRestrictionReason =
                SHIFT_SIGNUP_RESTRICTION_MESSAGES.rosterSignupRequired;
            } else if (!groupGateOpen) {
              signupRestrictionReason = shiftSignupAccessMessage(
                shiftSignupAccess ?? {
                  hasGroup: false,
                  signupOpen: false,
                },
              );
            } else if (
              schedule.chorePlanID &&
              attendanceWindow &&
              !shiftTimeRangeContains(
                {
                  startTime: attendanceWindow.estimatedArrivalDate,
                  endTime: attendanceWindow.estimatedDepartureDate,
                },
                shift,
              )
            ) {
              signupRestrictionReason =
                SHIFT_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow;
            } else if (schedule.chorePlanID) {
              signupConflictShiftIDs = existingSignups
                .filter(
                  (existingSignup) =>
                    Number(existingSignup.shiftID) !== Number(shift.id) &&
                    shiftTimeRangesOverlap(shift, existingSignup),
                )
                .map((existingSignup) => Number(existingSignup.shiftID));
              if (signupConflictShiftIDs.length > 0) {
                signupRestrictionReason =
                  SHIFT_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict;
              }
            }
          }
        }

        return {
          shift,
          scheduleName: schedule.name,
          participants,
          signupOpen: planSignupOpen && groupGateOpen,
          chorePlanStatus: schedule.chorePlanID
            ? (statusByPlanID.get(Number(schedule.chorePlanID)) ?? null)
            : null,
          signupRestrictionReason,
          signupConflictShiftIDs,
        };
      },
    );

    const shiftViewModelsResolved = await Promise.all(shiftViewModels);
    return shiftViewModelsResolved;
  }
}
