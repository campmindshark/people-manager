import { Knex } from 'knex';
import ChorePlan from '../models/chore_plan/chore_plan';
import ChorePlanChangeHistoryError from '../utils/chorePlanChangeHistoryError';
import { ChoreCatalogKind } from '../view_models/chore_catalog';
import {
  ChorePlanChangeHistoryAction,
  ChorePlanChangeHistoryAssignment,
  ChorePlanChangeHistoryEntry,
  ChorePlanChangeHistoryResponse,
  ChorePlanChangeHistoryShift,
  ChorePlanChangeHistoryUser,
  ChorePlanDraftAuditSnapshot,
} from '../view_models/chore_plan_change_history';
import { ChorePlanRequirements } from '../view_models/chore_plan_preview';

const CHANGE_HISTORY_LIMIT = 100;

interface AuditRow {
  id: number;
  chorePlanID: number;
  actorUserID: number;
  action: ChorePlanChangeHistoryAction;
  details: Record<string, unknown> | string;
  createdAt: Date | string;
}

interface UserRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  playaName: string | null;
}

interface ShiftRow {
  id: number;
  stableKey: string;
  kind: ChoreCatalogKind;
  scheduleName: string;
  displayDayLabel: string;
  timePeriodLabel: string;
}

interface StoredAssignment {
  action: 'added' | 'removed';
  userID: number;
  shiftID: number;
}

interface StoredRemovedAssignment {
  shiftID: number;
  stableKey: string;
  kind: ChoreCatalogKind;
}

interface StoredAdminAssignmentDetails {
  operation: 'assign' | 'unassign' | 'move' | 'swap';
  affectedAssignments: StoredAssignment[];
  forced: boolean;
  reason: string | null;
  bypassedRules: string[];
}

interface StoredRequirementDetails {
  participantUserID: number;
  previousRequirements: ChorePlanRequirements;
  requirements: ChorePlanRequirements;
  previousReason: string | null;
  reason: string;
  removedAssignments: StoredRemovedAssignment[];
}

interface StoredDraftDetails {
  previous: ChorePlanDraftAuditSnapshot | null;
  current: ChorePlanDraftAuditSnapshot;
}

interface StoredLifecycleDetails {
  fromStatus: 'draft' | 'open' | 'closed';
  toStatus: 'draft' | 'open' | 'closed';
  reason?: string;
}

function parseDetails<T>(details: Record<string, unknown> | string): T {
  const parsed = typeof details === 'string' ? JSON.parse(details) : details;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A stored chore plan audit entry is invalid.');
  }
  return parsed as T;
}

function timestamp(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('A stored chore plan audit timestamp is invalid.');
  }
  return date.toISOString();
}

function displayName(user: UserRow | undefined, userID: number): string {
  if (!user) {
    return `User ${userID}`;
  }
  const legalName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  const playaName = user.playaName?.trim() ?? '';
  if (playaName && legalName) {
    return `${playaName} (${legalName})`;
  }
  return playaName || legalName || `User ${userID}`;
}

export default class ChorePlanChangeHistoryController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChorePlan.knex();
  }

  async getByRosterID(
    rosterID: number,
  ): Promise<ChorePlanChangeHistoryResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanChangeHistoryError('Roster not found.', 404);
      }

      const plan = await transaction('chore_plans')
        .select('id')
        .where({ rosterID })
        .first();
      if (!plan) {
        return { rosterID, entries: [], hasMore: false };
      }

      const rows = (await transaction<AuditRow>('chore_plan_audit_entries')
        .select(
          'id',
          'chorePlanID',
          'actorUserID',
          'action',
          'details',
          'createdAt',
        )
        .where({ chorePlanID: plan.id })
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(CHANGE_HISTORY_LIMIT + 1)) as AuditRow[];
      const hasMore = rows.length > CHANGE_HISTORY_LIMIT;
      const visibleRows = rows.slice(0, CHANGE_HISTORY_LIMIT);
      const parsedRows = visibleRows.map((row) => ({
        row,
        details: parseDetails<Record<string, unknown>>(row.details),
      }));
      const userIDs = new Set<number>(
        visibleRows.map(({ actorUserID }) => actorUserID),
      );
      const shiftIDs = new Set<number>();

      parsedRows.forEach(({ row, details }) => {
        if (row.action === 'admin_assignment_mutated') {
          const assignmentDetails =
            details as unknown as StoredAdminAssignmentDetails;
          assignmentDetails.affectedAssignments.forEach(
            ({ userID, shiftID }) => {
              userIDs.add(userID);
              shiftIDs.add(shiftID);
            },
          );
        }
        if (
          row.action === 'participant_requirements_overridden' ||
          row.action === 'participant_requirements_cleared'
        ) {
          const requirementDetails =
            details as unknown as StoredRequirementDetails;
          userIDs.add(requirementDetails.participantUserID);
          requirementDetails.removedAssignments.forEach(({ shiftID }) =>
            shiftIDs.add(shiftID),
          );
        }
      });

      const users =
        userIDs.size === 0
          ? []
          : ((await transaction<UserRow>('users')
              .select('id', 'firstName', 'lastName', 'playaName')
              .whereIn('id', [...userIDs])) as UserRow[]);
      const shifts =
        shiftIDs.size === 0
          ? []
          : ((await transaction<ShiftRow>(
              'chore_plan_generated_shifts as generated',
            )
              .select(
                'generated.shiftID as id',
                'generated.stableKey',
                'generated.kind',
                'generated.scheduleName',
                'generated.displayDayLabel',
                'generated.timePeriodLabel',
              )
              .where('generated.chorePlanID', plan.id)
              .whereIn('generated.shiftID', [...shiftIDs])) as ShiftRow[]);
      const usersByID = new Map(users.map((user) => [user.id, user]));
      const shiftsByID = new Map(shifts.map((shift) => [shift.id, shift]));

      const userIdentity = (userID: number): ChorePlanChangeHistoryUser => ({
        id: userID,
        name: displayName(usersByID.get(userID), userID),
      });
      const shiftIdentity = (
        shiftID: number,
        stored?: StoredRemovedAssignment,
      ): ChorePlanChangeHistoryShift => {
        const shift = shiftsByID.get(shiftID);
        return {
          id: shiftID,
          stableKey: shift?.stableKey ?? stored?.stableKey ?? null,
          kind: shift?.kind ?? stored?.kind ?? null,
          scheduleName: shift?.scheduleName ?? `Shift ${shiftID}`,
          displayDayLabel: shift?.displayDayLabel ?? null,
          timePeriodLabel: shift?.timePeriodLabel ?? null,
        };
      };
      const assignment = (
        stored: StoredAssignment,
      ): ChorePlanChangeHistoryAssignment => ({
        action: stored.action,
        participant: userIdentity(stored.userID),
        shift: shiftIdentity(stored.shiftID),
      });

      const entries = parsedRows.map(({ row, details }) => {
        const base = {
          id: row.id,
          chorePlanID: row.chorePlanID,
          actor: userIdentity(row.actorUserID),
          createdAt: timestamp(row.createdAt),
        };
        if (row.action === 'draft_applied' || row.action === 'draft_replaced') {
          return {
            ...base,
            action: row.action,
            details: details as unknown as StoredDraftDetails,
          };
        }
        if (
          row.action === 'plan_opened' ||
          row.action === 'plan_closed' ||
          row.action === 'plan_reopened'
        ) {
          const lifecycle = details as unknown as StoredLifecycleDetails;
          return {
            ...base,
            action: row.action,
            details: {
              fromStatus: lifecycle.fromStatus,
              toStatus: lifecycle.toStatus,
              reason: lifecycle.reason ?? null,
            },
          };
        }
        if (row.action === 'admin_assignment_mutated') {
          const admin = details as unknown as StoredAdminAssignmentDetails;
          return {
            ...base,
            action: row.action,
            details: {
              operation: admin.operation,
              affectedAssignments: admin.affectedAssignments.map(assignment),
              forced: admin.forced,
              reason: admin.reason,
              bypassedRules: admin.bypassedRules,
            },
          };
        }
        const requirement = details as unknown as StoredRequirementDetails;
        return {
          ...base,
          action: row.action,
          details: {
            participant: userIdentity(requirement.participantUserID),
            previousRequirements: requirement.previousRequirements,
            requirements: requirement.requirements,
            previousReason: requirement.previousReason,
            reason: requirement.reason,
            removedAssignments: requirement.removedAssignments.map(
              (removed): ChorePlanChangeHistoryAssignment => ({
                action: 'removed',
                participant: userIdentity(requirement.participantUserID),
                shift: shiftIdentity(removed.shiftID, removed),
              }),
            ),
          },
        };
      }) as ChorePlanChangeHistoryEntry[];

      return { rosterID, entries, hasMore };
    });
  }
}
