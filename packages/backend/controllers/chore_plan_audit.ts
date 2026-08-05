import { Knex } from 'knex';
import ChorePlanAuditEntry, {
  ChorePlanAuditAction,
  ChorePlanAuditDetails,
} from '../view_models/chore_plan_audit';

interface ChorePlanAuditRow {
  id: number;
  chorePlanID: number;
  actorUserID: number | null;
  actorName: string;
  action: ChorePlanAuditAction;
  details: ChorePlanAuditDetails | string;
  createdAt: Date | string;
}

interface AuditActorRow {
  firstName: string;
  lastName: string;
}

function parseDetails(
  details: ChorePlanAuditDetails | string,
): ChorePlanAuditDetails {
  if (typeof details !== 'string') {
    return details;
  }

  try {
    return JSON.parse(details) as ChorePlanAuditDetails;
  } catch (_error) {
    return {};
  }
}

export default class ChorePlanAuditController {
  public static async Record(
    transaction: Knex | Knex.Transaction,
    chorePlanID: number,
    actorUserID: number,
    action: ChorePlanAuditAction,
    details: ChorePlanAuditDetails = {},
  ): Promise<void> {
    const actor = await transaction<AuditActorRow>('users')
      .select('firstName', 'lastName')
      .where('id', actorUserID)
      .first();
    if (!actor) {
      throw new Error('Audit log actor was not found.');
    }

    const actorName = `${actor.firstName} ${actor.lastName}`.trim();
    await transaction('chore_plan_audit_entries').insert({
      chorePlanID,
      actorUserID,
      actorName: actorName || 'Unknown administrator',
      action,
      details,
    });
  }

  public static async GetByRosterID(
    transaction: Knex | Knex.Transaction,
    rosterID: number,
  ): Promise<ChorePlanAuditEntry[]> {
    const entries = await transaction<ChorePlanAuditRow>(
      'chore_plan_audit_entries',
    )
      .join(
        'chore_plans',
        'chore_plan_audit_entries.chorePlanID',
        '=',
        'chore_plans.id',
      )
      .select(
        'chore_plan_audit_entries.id',
        'chore_plan_audit_entries.chorePlanID',
        'chore_plan_audit_entries.actorUserID',
        'chore_plan_audit_entries.actorName',
        'chore_plan_audit_entries.action',
        'chore_plan_audit_entries.details',
        'chore_plan_audit_entries.createdAt',
      )
      .where('chore_plans.rosterID', rosterID)
      .orderBy('chore_plan_audit_entries.createdAt', 'desc')
      .orderBy('chore_plan_audit_entries.id', 'desc')
      .limit(100);

    return entries.map((entry) => ({
      id: entry.id,
      chorePlanID: entry.chorePlanID,
      actor: { id: entry.actorUserID, name: entry.actorName },
      action: entry.action,
      details: parseDetails(entry.details),
      createdAt: new Date(entry.createdAt).toISOString(),
    }));
  }
}
