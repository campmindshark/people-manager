import Knex, { Knex as KnexType } from 'knex';
import knexConfig from '../knexfile';
import Roster from '../models/roster/roster';
import ChorePlanAuditController from './chore_plan_audit';
import ChorePlanPreview, {
  CHORE_PLAN_KINDS,
  ChorePlanActorSummary,
  ChorePlanApplyResult,
  ChorePlanParticipantRequirements,
  ChorePlanRequirements,
  ChorePlanStatus,
  ChorePlanSummary,
} from '../view_models/chore_plan';
import ChorePlanAuditEntry from '../view_models/chore_plan_audit';
import { getConfig } from '../config/config';
import { buildChorePlan, fetchScoreSheet } from '../utils/chorePlan';
import ChorePlanError from '../utils/chorePlanError';
import {
  ChorePlanRequirementColumns,
  effectiveRequirements,
  requirementsFromColumns,
  requirementsToColumns,
  validateRequirements,
} from '../utils/chorePlanRequirements';

const knex = Knex(knexConfig[getConfig().Environment]);

interface ChorePlanRow extends ChorePlanRequirementColumns {
  id: number;
  rosterID: number;
  camperCount: number;
  sheetUrl: string;
  sheetTitle: string;
  status: ChorePlanStatus;
  openedAt: Date | string | null;
  openedByUserID: number | null;
  closedAt: Date | string | null;
  closedByUserID: number | null;
  updatedAt: Date | string;
}

interface ChorePlanActorRow {
  id: number;
  firstName: string;
  lastName: string;
}

interface RequirementOverrideRow extends ChorePlanRequirementColumns {
  chorePlanID: number;
  userID: number;
  reason: string;
}

function actorSummary(
  userID: number | null,
  actorsByID: Map<number, ChorePlanActorRow>,
): ChorePlanActorSummary | null {
  if (!userID) {
    return null;
  }
  const actor = actorsByID.get(userID);
  return actor
    ? { id: actor.id, name: `${actor.firstName} ${actor.lastName}`.trim() }
    : null;
}

export default class ChorePlanController {
  public static async GetAuditLog(
    rosterID: number,
  ): Promise<ChorePlanAuditEntry[]> {
    return ChorePlanAuditController.GetByRosterID(knex, rosterID);
  }

  public static async GetByRosterID(
    rosterID: number,
    transaction: KnexType | KnexType.Transaction = knex,
  ): Promise<ChorePlanSummary | null> {
    const plan = await transaction<ChorePlanRow>('chore_plans')
      .where('rosterID', rosterID)
      .first();
    if (!plan) {
      return null;
    }

    const schedules = await transaction('schedules').where(
      'chorePlanID',
      plan.id,
    );
    const scheduleIDs = schedules.map((schedule) => schedule.id as number);
    const shifts = scheduleIDs.length
      ? await transaction('shifts').whereIn('scheduleID', scheduleIDs)
      : [];
    const actorIDs = [plan.openedByUserID, plan.closedByUserID].filter(
      (userID): userID is number => userID !== null,
    );
    const actors = actorIDs.length
      ? await transaction<ChorePlanActorRow>('users')
          .select('id', 'firstName', 'lastName')
          .whereIn('id', actorIDs)
      : [];
    const actorsByID = new Map(actors.map((actor) => [actor.id, actor]));

    return {
      id: plan.id,
      rosterID: plan.rosterID,
      camperCount: plan.camperCount,
      sheetUrl: plan.sheetUrl,
      sheetTitle: plan.sheetTitle,
      requirements: requirementsFromColumns(plan),
      scheduleCount: schedules.length,
      shiftCount: shifts.length,
      slotCount: shifts.reduce(
        (total, shift) => total + Number(shift.requiredParticipants ?? 0),
        0,
      ),
      status: plan.status,
      openedAt: plan.openedAt ? new Date(plan.openedAt).toISOString() : null,
      openedBy: actorSummary(plan.openedByUserID, actorsByID),
      closedAt: plan.closedAt ? new Date(plan.closedAt).toISOString() : null,
      closedBy: actorSummary(plan.closedByUserID, actorsByID),
      updatedAt: new Date(plan.updatedAt).toISOString(),
    };
  }

  public static async OpenSignups(
    rosterID: number,
    actorUserID: number,
  ): Promise<ChorePlanSummary> {
    return ChorePlanController.TransitionSignups(rosterID, actorUserID, 'open');
  }

  public static async CloseSignups(
    rosterID: number,
    actorUserID: number,
  ): Promise<ChorePlanSummary> {
    return ChorePlanController.TransitionSignups(
      rosterID,
      actorUserID,
      'closed',
    );
  }

  private static async TransitionSignups(
    rosterID: number,
    actorUserID: number,
    nextStatus: Extract<ChorePlanStatus, 'open' | 'closed'>,
  ): Promise<ChorePlanSummary> {
    return knex.transaction(async (transaction) => {
      const plan = await transaction<ChorePlanRow>('chore_plans')
        .where('rosterID', rosterID)
        .forUpdate()
        .first();
      if (!plan) {
        throw new ChorePlanError(
          `Create the chore plan before ${
            nextStatus === 'open' ? 'opening' : 'closing'
          } signups.`,
          404,
        );
      }

      if (plan.status === nextStatus) {
        const existingSummary = await ChorePlanController.GetByRosterID(
          rosterID,
          transaction,
        );
        if (!existingSummary) {
          throw new Error('Chore plan could not be reloaded.');
        }
        return existingSummary;
      }

      if (nextStatus === 'closed' && plan.status !== 'open') {
        throw new ChorePlanError(
          'Open chore signups before closing the plan.',
          409,
        );
      }

      if (nextStatus === 'open') {
        await transaction('chore_plans').where('id', plan.id).update({
          status: 'open',
          openedAt: transaction.fn.now(),
          openedByUserID: actorUserID,
          updatedAt: transaction.fn.now(),
        });
      } else {
        await transaction('chore_plans').where('id', plan.id).update({
          status: 'closed',
          closedAt: transaction.fn.now(),
          closedByUserID: actorUserID,
          updatedAt: transaction.fn.now(),
        });
      }

      await ChorePlanAuditController.Record(
        transaction,
        plan.id,
        actorUserID,
        nextStatus === 'open' ? 'signups_opened' : 'signups_closed',
      );

      const summary = await ChorePlanController.GetByRosterID(
        rosterID,
        transaction,
      );
      if (!summary) {
        throw new Error('Updated chore plan could not be reloaded.');
      }
      return summary;
    });
  }

  public static async Preview(
    rosterID: number,
    camperCount: number,
    sheetUrl: string,
    requirements: ChorePlanRequirements,
  ): Promise<ChorePlanPreview> {
    const roster = await Roster.query().findById(rosterID);
    if (!roster) {
      throw new Error('Roster not found.');
    }
    const [sheet, existingPlan] = await Promise.all([
      fetchScoreSheet(sheetUrl),
      ChorePlanController.GetByRosterID(rosterID),
    ]);
    const preview = buildChorePlan({
      rosterID,
      year: roster.year,
      camperCount,
      sheetUrl,
      sheetTitle: sheet.title,
      requirements,
      chores: sheet.chores,
      events: sheet.events,
      dinners: sheet.dinners,
    });
    preview.existingPlan = existingPlan;
    return preview;
  }

  public static async Apply(
    preview: ChorePlanPreview,
    actorUserID: number,
  ): Promise<ChorePlanApplyResult> {
    const hasShortage = Object.values(preview.categories).some(
      (category) => category.shortage > 0,
    );
    if (hasShortage) {
      throw new ChorePlanError(
        'The score sheet does not contain enough positions for this camper count.',
        422,
      );
    }

    return knex.transaction(async (transaction) => {
      let plan = await transaction<ChorePlanRow>('chore_plans')
        .where('rosterID', preview.rosterID)
        .forUpdate()
        .first();
      const previousPlan = plan
        ? {
            camperCount: plan.camperCount,
            sheetTitle: plan.sheetTitle,
            sheetUrl: plan.sheetUrl,
            requirements: requirementsFromColumns(plan),
          }
        : null;
      if (plan?.status === 'closed') {
        throw new ChorePlanError(
          'This chore plan is closed. Reopen it before making changes.',
          409,
        );
      }
      if (plan && preview.camperCount < plan.camperCount) {
        throw new ChorePlanError(
          `This roster already has a ${plan.camperCount}-camper plan. Existing signup capacity cannot be reduced.`,
          409,
        );
      }

      if (!plan) {
        [plan] = await transaction<ChorePlanRow>('chore_plans')
          .insert({
            rosterID: preview.rosterID,
            camperCount: preview.camperCount,
            sheetUrl: preview.sheetUrl,
            sheetTitle: preview.sheetTitle,
            ...requirementsToColumns(preview.requirements),
          })
          .returning('*');
      }
      if (!plan) {
        throw new Error('Generated chore plan could not be created.');
      }
      const planID = plan.id;

      const scheduleDescriptors = [
        ...new Map(
          preview.shifts.map((plannedShift) => [
            plannedShift.scheduleKey,
            {
              rosterID: preview.rosterID,
              name: plannedShift.scheduleName,
              description: `Generated ${plannedShift.kind} signup schedule from ${preview.sheetTitle}.`,
              chorePlanID: planID,
              plannerKey: plannedShift.scheduleKey,
            },
          ]),
        ).values(),
      ];
      const existingSchedules = await transaction('schedules').where(
        'chorePlanID',
        planID,
      );
      const existingScheduleKeys = new Set(
        existingSchedules.map((schedule) => schedule.plannerKey as string),
      );
      const missingSchedules = scheduleDescriptors.filter(
        (schedule) => !existingScheduleKeys.has(schedule.plannerKey),
      );
      const createdScheduleRows = missingSchedules.length
        ? await transaction('schedules')
            .insert(missingSchedules)
            .returning(['id', 'plannerKey'])
        : [];
      const allSchedules = [...existingSchedules, ...createdScheduleRows];
      const scheduleIDs = new Map<string, number>(
        allSchedules.map((schedule) => [
          schedule.plannerKey as string,
          Number(schedule.id),
        ]),
      );

      const existingShifts = await transaction('shifts').whereIn('scheduleID', [
        ...scheduleIDs.values(),
      ]);
      const existingShiftsByKey = new Map(
        existingShifts.map((shift) => [
          `${shift.scheduleID}|${shift.plannerKey}`,
          shift,
        ]),
      );
      const plannedShifts = preview.shifts.map((plannedShift) => {
        const scheduleID = scheduleIDs.get(plannedShift.scheduleKey);
        if (!scheduleID) {
          throw new Error(
            `Generated schedule was not found for ${plannedShift.scheduleName}.`,
          );
        }
        return { ...plannedShift, scheduleID };
      });
      const newShifts = plannedShifts.filter(
        (plannedShift) =>
          !existingShiftsByKey.has(
            `${plannedShift.scheduleID}|${plannedShift.key}`,
          ),
      );
      if (newShifts.length) {
        await transaction('shifts').insert(
          newShifts.map((plannedShift) => ({
            scheduleID: plannedShift.scheduleID,
            startTime: new Date(plannedShift.startTime),
            endTime: new Date(plannedShift.endTime),
            requiredParticipants: plannedShift.requiredParticipants,
            plannerKey: plannedShift.key,
          })),
        );
      }

      const capacityUpdates = plannedShifts
        .map((plannedShift) => ({
          plannedShift,
          existingShift: existingShiftsByKey.get(
            `${plannedShift.scheduleID}|${plannedShift.key}`,
          ),
        }))
        .filter(
          ({ plannedShift, existingShift }) =>
            existingShift &&
            plannedShift.requiredParticipants >
              Number(existingShift.requiredParticipants),
        );
      await Promise.all(
        capacityUpdates.map(({ plannedShift, existingShift }) =>
          transaction('shifts').where('id', existingShift.id).update({
            requiredParticipants: plannedShift.requiredParticipants,
          }),
        ),
      );

      const addedSlots =
        newShifts.reduce(
          (total, plannedShift) => total + plannedShift.requiredParticipants,
          0,
        ) +
        capacityUpdates.reduce(
          (total, { plannedShift, existingShift }) =>
            total +
            plannedShift.requiredParticipants -
            Number(existingShift.requiredParticipants),
          0,
        );

      await transaction('chore_plans')
        .where('id', planID)
        .update({
          camperCount: preview.camperCount,
          sheetUrl: preview.sheetUrl,
          sheetTitle: preview.sheetTitle,
          ...requirementsToColumns(preview.requirements),
          updatedAt: transaction.fn.now(),
        });

      const summary = await ChorePlanController.GetByRosterID(
        preview.rosterID,
        transaction,
      );
      if (!summary) {
        throw new Error('Generated chore plan could not be reloaded.');
      }

      const planChanged =
        previousPlan === null ||
        previousPlan.camperCount !== summary.camperCount ||
        previousPlan.sheetTitle !== summary.sheetTitle ||
        previousPlan.sheetUrl !== summary.sheetUrl ||
        CHORE_PLAN_KINDS.some(
          (kind) =>
            previousPlan.requirements[kind] !== summary.requirements[kind],
        ) ||
        addedSlots > 0 ||
        createdScheduleRows.length > 0 ||
        newShifts.length > 0;
      if (planChanged) {
        await ChorePlanAuditController.Record(
          transaction,
          planID,
          actorUserID,
          previousPlan ? 'plan_updated' : 'plan_created',
          {
            camperCount: summary.camperCount,
            ...(previousPlan
              ? {
                  previousCamperCount: previousPlan.camperCount,
                  previousSheetTitle: previousPlan.sheetTitle,
                  previousRequirements: previousPlan.requirements,
                }
              : {}),
            slotCount: summary.slotCount,
            addedSlots,
            createdSchedules: createdScheduleRows.length,
            createdShifts: newShifts.length,
            sheetTitle: summary.sheetTitle,
            requirements: summary.requirements,
          },
        );
      }
      return {
        plan: summary,
        addedSlots,
        createdSchedules: createdScheduleRows.length,
        createdShifts: newShifts.length,
      };
    });
  }

  public static async SetParticipantRequirements(
    rosterID: number,
    userID: number,
    requirements: ChorePlanRequirements,
    reason: string,
    actorUserID: number,
  ): Promise<ChorePlanParticipantRequirements> {
    return knex.transaction(async (transaction) => {
      const plan = await transaction<ChorePlanRow>('chore_plans')
        .where('rosterID', rosterID)
        .forUpdate()
        .first();
      if (!plan) {
        throw new ChorePlanError(
          'Create the chore plan before adding requirement exceptions.',
          404,
        );
      }
      if (plan.status === 'closed') {
        throw new ChorePlanError(
          'This chore plan is closed. Reopen it before making changes.',
          409,
        );
      }

      const participant = await transaction('roster_participants')
        .where({ rosterID, userID })
        .first();
      if (!participant) {
        throw new ChorePlanError('User is not signed up for this roster.', 404);
      }

      const [participantUser, existingOverride] = await Promise.all([
        transaction<ChorePlanActorRow>('users')
          .select('id', 'firstName', 'lastName')
          .where('id', userID)
          .first(),
        transaction<RequirementOverrideRow>('chore_plan_requirement_overrides')
          .where({ chorePlanID: plan.id, userID })
          .first(),
      ]);
      if (!participantUser) {
        throw new ChorePlanError('User not found.', 404);
      }
      const participantName =
        `${participantUser.firstName} ${participantUser.lastName}`.trim();
      const previousRequirements = existingOverride
        ? requirementsFromColumns(existingOverride)
        : undefined;

      const planRequirements = requirementsFromColumns(plan);
      const validatedRequirements = validateRequirements(
        requirements,
        planRequirements,
      );
      const effective = effectiveRequirements(
        planRequirements,
        validatedRequirements,
      );
      const hasReduction = CHORE_PLAN_KINDS.some(
        (kind) => effective[kind] < planRequirements[kind],
      );

      if (!hasReduction) {
        const deletedCount = await transaction(
          'chore_plan_requirement_overrides',
        )
          .where({ chorePlanID: plan.id, userID })
          .del();
        if (deletedCount > 0) {
          await ChorePlanAuditController.Record(
            transaction,
            plan.id,
            actorUserID,
            'participant_requirements_reset',
            {
              participantUserID: userID,
              participantName,
              requirements: planRequirements,
              previousRequirements,
              previousReason: existingOverride?.reason,
            },
          );
        }
        return {
          userID,
          requirements: planRequirements,
          hasCustomRequirements: false,
          requirementExceptionReason: null,
        };
      }

      const normalizedReason = reason.trim();
      if (!normalizedReason) {
        throw new ChorePlanError(
          'Add a reason for reduced requirements or an exemption.',
          400,
        );
      }
      if (normalizedReason.length > 500) {
        throw new ChorePlanError(
          'The requirement exception reason must be 500 characters or fewer.',
          400,
        );
      }

      await transaction('chore_plan_requirement_overrides')
        .insert({
          chorePlanID: plan.id,
          userID,
          ...requirementsToColumns(effective),
          reason: normalizedReason,
        })
        .onConflict(['chorePlanID', 'userID'])
        .merge({
          ...requirementsToColumns(effective),
          reason: normalizedReason,
          updatedAt: transaction.fn.now(),
        });

      const overrideChanged =
        !existingOverride ||
        existingOverride.reason !== normalizedReason ||
        CHORE_PLAN_KINDS.some(
          (kind) => previousRequirements?.[kind] !== effective[kind],
        );
      if (overrideChanged) {
        await ChorePlanAuditController.Record(
          transaction,
          plan.id,
          actorUserID,
          'participant_requirements_updated',
          {
            participantUserID: userID,
            participantName,
            requirements: effective,
            previousRequirements,
            reason: normalizedReason,
            previousReason: existingOverride?.reason,
          },
        );
      }

      return {
        userID,
        requirements: effective,
        hasCustomRequirements: true,
        requirementExceptionReason: normalizedReason,
      };
    });
  }

  public static async ResetParticipantRequirements(
    rosterID: number,
    userID: number,
    actorUserID: number,
  ): Promise<ChorePlanParticipantRequirements> {
    return knex.transaction(async (transaction) => {
      const plan = await transaction<ChorePlanRow>('chore_plans')
        .where('rosterID', rosterID)
        .forUpdate()
        .first();
      if (!plan) {
        throw new ChorePlanError('Chore plan not found.', 404);
      }
      if (plan.status === 'closed') {
        throw new ChorePlanError(
          'This chore plan is closed. Reopen it before making changes.',
          409,
        );
      }

      const existingOverride = await transaction<RequirementOverrideRow>(
        'chore_plan_requirement_overrides',
      )
        .where({ chorePlanID: plan.id, userID })
        .first();
      const deletedCount = await transaction('chore_plan_requirement_overrides')
        .where({ chorePlanID: plan.id, userID })
        .del();
      if (deletedCount > 0) {
        const participantUser = await transaction<ChorePlanActorRow>('users')
          .select('id', 'firstName', 'lastName')
          .where('id', userID)
          .first();
        await ChorePlanAuditController.Record(
          transaction,
          plan.id,
          actorUserID,
          'participant_requirements_reset',
          {
            participantUserID: userID,
            participantName: participantUser
              ? `${participantUser.firstName} ${participantUser.lastName}`.trim()
              : 'Unknown participant',
            requirements: requirementsFromColumns(plan),
            previousRequirements: existingOverride
              ? requirementsFromColumns(existingOverride)
              : undefined,
            previousReason: existingOverride?.reason,
          },
        );
      }
      return {
        userID,
        requirements: requirementsFromColumns(plan),
        hasCustomRequirements: false,
        requirementExceptionReason: null,
      };
    });
  }
}
