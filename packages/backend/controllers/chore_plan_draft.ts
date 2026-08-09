import { createHash } from 'node:crypto';
import { Knex } from 'knex';
import Roster from '../models/roster/roster';
import ChoreCatalogController from './chore_catalog';
import buildChorePlanPreview from '../utils/chorePlanPreview';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import {
  chorePlanAssignmentDifference,
  chorePlanAssignmentIdentity,
  chorePlanPreviewAssignmentMap,
  withChorePlanAssignmentEligibility,
} from '../utils/chorePlanAssignmentEligibility';
import { ChoreCatalogDefinitionView } from '../view_models/chore_catalog';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDisabledAssignment,
  ChorePlanDraftResponse,
  ChorePlanDraftSummary,
  ChorePlanPreview,
  ChorePlanRequirements,
} from '../view_models/chore_plan_preview';

interface RosterRow {
  id: number;
  year: number;
}

interface ChorePlanRow {
  id: number;
  rosterID: number;
  status: 'draft' | 'open' | 'closed';
  planningYear: number;
  camperCount: number;
  choreRequirement: number;
  eventRequirement: number;
  dinnerRequirement: number;
  catalogRevision: string;
  draftRevision: string;
  generationHash: string;
  openedAt: Date | string | null;
  updatedAt: Date | string;
}

interface ScheduleRow {
  id: number;
  chorePlanID: number;
  plannerKey: string | null;
}

interface ShiftRow {
  id: number;
  scheduleID: number;
  plannerKey: string | null;
}

interface IDRow {
  id: number;
}

interface CountRow {
  count: string;
}

interface AssignmentCountRow extends CountRow {
  shiftID: number;
}

interface PersistedSlotRow extends ChorePlanDisabledAssignment {
  shiftID: number;
  kind: 'chore' | 'event' | 'dinner';
}

interface AdminAddedAssignmentRow extends ChorePlanDisabledAssignment {
  id: number;
  chorePlanID: number;
  addedAfterOpening: boolean;
  createdAt: Date | string;
}

interface DraftCounts {
  scheduleCount: number;
  shiftCount: number;
  slotCount: number;
}

interface GeneratedShiftInsert {
  shiftID: number;
  chorePlanID: number;
  stableKey: string;
  scheduleKey: string;
  kind: 'chore' | 'event' | 'dinner';
  scheduleName: string;
  displayDayNumber: number;
  displayDayLabel: string;
  calendarDay: number;
  timePeriodLabel: string;
  periodOrder: number | null;
  totalScore: number;
}

interface SlotSnapshotInsert {
  shiftID: number;
  slotOrder: number;
  definitionKey: string;
  kind: 'chore' | 'event' | 'dinner';
  shiftLabel: string;
  positionLabel: string;
  dayMode: 'template' | 'explicit';
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
  sourceOrder: number;
  score: number;
}

function requirementsFromPlan(plan: ChorePlanRow): ChorePlanRequirements {
  return {
    chore: plan.choreRequirement,
    event: plan.eventRequirement,
    dinner: plan.dinnerRequirement,
  };
}

function requirementsToColumns(requirements: ChorePlanRequirements) {
  return {
    choreRequirement: requirements.chore,
    eventRequirement: requirements.event,
    dinnerRequirement: requirements.dinner,
  };
}

function generationHash(preview: ChorePlanPreview): string {
  const {
    disabledSlots: _disabledSlots,
    disableableAssignments: _disableableAssignments,
    reenableableAssignments: _reenableableAssignments,
    ...canonicalPreview
  } = preview;
  const { disabledAssignments, ...legacyPreview } = canonicalPreview;
  const hashInput = disabledAssignments.length
    ? canonicalPreview
    : legacyPreview;
  return createHash('sha256').update(JSON.stringify(hashInput)).digest('hex');
}

function nextRevision(revision: string): string {
  return (BigInt(revision) + 1n).toString();
}

function previewCounts(preview: ChorePlanPreview): DraftCounts {
  return {
    scheduleCount: new Set(preview.shifts.map(({ scheduleKey }) => scheduleKey))
      .size,
    shiftCount: preview.shifts.length,
    slotCount: preview.shifts.reduce(
      (total, shift) => total + shift.slots.length,
      0,
    ),
  };
}

async function loadDraftCounts(
  database: Knex,
  chorePlanID: number,
): Promise<DraftCounts> {
  const [scheduleCount, shiftCount, slotCount] = await Promise.all([
    database('schedules')
      .where({ chorePlanID })
      .count('* as count')
      .first() as Promise<CountRow | undefined>,
    database('chore_plan_generated_shifts')
      .where({ chorePlanID })
      .count('* as count')
      .first() as Promise<CountRow | undefined>,
    database('chore_plan_slot_snapshots as slot')
      .innerJoin(
        'chore_plan_generated_shifts as generated',
        'generated.shiftID',
        'slot.shiftID',
      )
      .where('generated.chorePlanID', chorePlanID)
      .count('* as count')
      .first() as Promise<CountRow | undefined>,
  ]);

  return {
    scheduleCount: Number(scheduleCount?.count ?? 0),
    shiftCount: Number(shiftCount?.count ?? 0),
    slotCount: Number(slotCount?.count ?? 0),
  };
}

function disabledAssignmentIdentity(
  assignment: ChorePlanDisabledAssignment,
): string {
  return chorePlanAssignmentIdentity(assignment);
}

function mergeDisabledAssignments(
  ...collections: ChorePlanDisabledAssignment[][]
): ChorePlanDisabledAssignment[] {
  return [
    ...new Map(
      collections
        .flat()
        .map((assignment) => [
          disabledAssignmentIdentity(assignment),
          assignment,
        ]),
    ).values(),
  ]
    .sort((first, second) =>
      disabledAssignmentIdentity(first).localeCompare(
        disabledAssignmentIdentity(second),
      ),
    )
    .map(({ shiftKey, definitionKey }) => ({ shiftKey, definitionKey }));
}

async function loadDisabledAssignments(
  database: Knex,
  chorePlanID: number,
): Promise<ChorePlanDisabledAssignment[]> {
  return (await database('chore_plan_disabled_assignments')
    .select('shiftKey', 'definitionKey')
    .where({ chorePlanID })
    .orderBy(['shiftKey', 'definitionKey'])) as ChorePlanDisabledAssignment[];
}

async function loadPersistedSlots(
  database: Knex,
  chorePlanID: number,
): Promise<PersistedSlotRow[]> {
  return (await database('chore_plan_slot_snapshots as slot')
    .innerJoin(
      'chore_plan_generated_shifts as generated',
      'generated.shiftID',
      'slot.shiftID',
    )
    .select(
      'generated.shiftID',
      'generated.stableKey as shiftKey',
      'generated.kind',
      'slot.definitionKey',
    )
    .where('generated.chorePlanID', chorePlanID)) as PersistedSlotRow[];
}

async function loadAssignmentCounts(
  database: Knex,
  shiftIDs: number[],
): Promise<Map<number, number>> {
  if (!shiftIDs.length) {
    return new Map();
  }
  const rows = (await database<AssignmentCountRow>('shift_participants')
    .select('shiftID')
    .count('* as count')
    .whereIn('shiftID', shiftIDs)
    .groupBy('shiftID')) as AssignmentCountRow[];
  return new Map(rows.map(({ shiftID, count }) => [shiftID, Number(count)]));
}

function storedAssignmentMap(
  slots: PersistedSlotRow[],
): Map<string, PersistedSlotRow> {
  return new Map(
    slots.map((slot) => [chorePlanAssignmentIdentity(slot), slot]),
  );
}

function previewCapacitiesAreSafe(
  preview: ChorePlanPreview,
  slots: PersistedSlotRow[],
  assignmentCounts: Map<number, number>,
): boolean {
  const capacityByShiftKey = new Map(
    preview.shifts.map((shift) => [shift.stableKey, shift.slots.length]),
  );
  const shiftKeyByID = new Map(
    slots.map(({ shiftID, shiftKey }) => [shiftID, shiftKey]),
  );
  return [...assignmentCounts].every(
    ([shiftID, count]) =>
      count <= (capacityByShiftKey.get(shiftKeyByID.get(shiftID) ?? '') ?? 0),
  );
}

function planInputsMatchRequest(
  plan: ChorePlanRow,
  input: ChorePlanApplyRequest,
): boolean {
  return (
    plan.camperCount === input.camperCount &&
    plan.choreRequirement === input.requirements.chore &&
    plan.eventRequirement === input.requirements.event &&
    plan.dinnerRequirement === input.requirements.dinner
  );
}

async function recordAddedAssignments(
  database: Knex,
  chorePlanID: number,
  assignments: ChorePlanDisabledAssignment[],
  actorUserID: number,
  addedAfterOpening: boolean,
): Promise<void> {
  if (!assignments.length) {
    return;
  }
  await database('chore_plan_admin_added_assignments')
    .insert(
      assignments.map(({ shiftKey, definitionKey }) => ({
        chorePlanID,
        shiftKey,
        definitionKey,
        addedAfterOpening,
        addedByUserID: actorUserID,
      })),
    )
    .onConflict(['chorePlanID', 'shiftKey', 'definitionKey'])
    .merge({
      addedAfterOpening,
      addedByUserID: actorUserID,
      createdAt: database.fn.now(),
    });
}

function draftSummary(
  plan: ChorePlanRow,
  counts: DraftCounts,
  disabledAssignments: ChorePlanDisabledAssignment[],
): ChorePlanDraftSummary {
  return {
    id: plan.id,
    rosterID: plan.rosterID,
    status: plan.status,
    draftRevision: String(plan.draftRevision),
    catalogRevision: String(plan.catalogRevision),
    planningYear: plan.planningYear,
    camperCount: plan.camperCount,
    requirements: requirementsFromPlan(plan),
    disabledAssignments,
    ...counts,
    updatedAt: new Date(plan.updatedAt).toISOString(),
  };
}

function auditSnapshot(
  plan: ChorePlanRow | undefined,
  hash: string,
  preview: ChorePlanPreview,
  counts: DraftCounts,
) {
  return {
    draftRevision: plan ? String(plan.draftRevision) : '1',
    catalogRevision: preview.catalogRevision,
    generationHash: hash,
    planningYear: preview.year,
    camperCount: preview.camperCount,
    requirements: preview.requirements,
    ...counts,
  };
}

export default class ChorePlanDraftController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? Roster.knex();
  }

  async getByRosterID(rosterID: number): Promise<ChorePlanDraftResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = await transaction('rosters')
        .select('id')
        .where({ id: rosterID })
        .first();
      if (!roster) {
        throw new ChorePlanPreviewError('Roster not found.', 404);
      }

      const plan = (await transaction<ChorePlanRow>('chore_plans')
        .where({ rosterID })
        .first()) as ChorePlanRow | undefined;
      if (!plan) {
        return { draft: null };
      }
      const [counts, disabledAssignments] = await Promise.all([
        loadDraftCounts(transaction, plan.id),
        loadDisabledAssignments(transaction, plan.id),
      ]);
      return { draft: draftSummary(plan, counts, disabledAssignments) };
    });
  }

  async apply(
    input: ChorePlanApplyRequest,
    actorUserID: number,
  ): Promise<ChorePlanApplyResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const catalogState = await transaction('chore_catalog_state')
        .where({ id: 1 })
        .forUpdate()
        .first();
      if (!catalogState) {
        throw new ChorePlanPreviewError(
          'The chore catalog is unavailable.',
          500,
        );
      }
      if (String(catalogState.revision) !== input.expectedCatalogRevision) {
        throw new ChorePlanPreviewError(
          'The chore catalog changed. Preview the plan again.',
          409,
        );
      }

      const roster = (await transaction('rosters')
        .select('id', 'year')
        .where({ id: input.rosterID })
        .first()) as RosterRow | undefined;
      if (!roster) {
        throw new ChorePlanPreviewError('Roster not found.', 404);
      }

      const catalog = await new ChoreCatalogController(
        transaction,
      ).getCatalog();
      if (catalog.revision !== input.expectedCatalogRevision) {
        throw new ChorePlanPreviewError(
          'The chore catalog changed. Preview the plan again.',
          409,
        );
      }
      let plan = (await transaction<ChorePlanRow>('chore_plans')
        .where({ rosterID: input.rosterID })
        .forUpdate()
        .first()) as ChorePlanRow | undefined;

      if (plan?.status === 'closed') {
        throw new ChorePlanPreviewError(
          'A closed chore plan cannot be edited. Reopen signups first.',
          409,
        );
      }
      const persistedDisabledAssignments = plan
        ? await loadDisabledAssignments(transaction, plan.id)
        : [];
      const disabledAssignments = mergeDisabledAssignments(
        input.disabledAssignments ?? persistedDisabledAssignments,
      );
      const build = (
        proposedDisabledAssignments: ChorePlanDisabledAssignment[],
      ) =>
        buildChorePlanPreview({
          rosterID: input.rosterID,
          camperCount: input.camperCount,
          requirements: input.requirements,
          disabledAssignments: proposedDisabledAssignments,
          year: roster.year,
          catalogRevision: catalog.revision,
          definitions: catalog.definitions,
        });
      const preview = build(disabledAssignments);
      if (
        Object.values(preview.categories).some(({ shortage }) => shortage > 0)
      ) {
        throw new ChorePlanPreviewError(
          'The chore catalog does not contain enough positions for this plan.',
          422,
        );
      }

      const hash = generationHash(preview);
      const expectedCounts = previewCounts(preview);

      if (plan?.generationHash === hash) {
        const counts = await loadDraftCounts(transaction, plan.id);
        if (
          counts.scheduleCount !== expectedCounts.scheduleCount ||
          counts.shiftCount !== expectedCounts.shiftCount ||
          counts.slotCount !== expectedCounts.slotCount
        ) {
          throw new ChorePlanPreviewError(
            'The stored chore plan draft is incomplete.',
            500,
          );
        }
        return {
          changed: false,
          replaced: false,
          draft: draftSummary(plan, counts, disabledAssignments),
          preview: await withChorePlanAssignmentEligibility(
            transaction,
            plan,
            preview,
            build,
          ),
        };
      }

      if (
        (plan && String(plan.draftRevision) !== input.expectedDraftRevision) ||
        (!plan && input.expectedDraftRevision !== null)
      ) {
        throw new ChorePlanPreviewError(
          'The chore plan draft changed. Preview it again before replacing it.',
          409,
        );
      }

      const persistedDisabledByIdentity = new Map(
        persistedDisabledAssignments.map((assignment) => [
          disabledAssignmentIdentity(assignment),
          assignment,
        ]),
      );
      const disabledByIdentity = new Map(
        disabledAssignments.map((assignment) => [
          disabledAssignmentIdentity(assignment),
          assignment,
        ]),
      );
      const newlyDisabledAssignments = chorePlanAssignmentDifference(
        disabledByIdentity,
        persistedDisabledByIdentity,
      );
      const reenabledAssignments = chorePlanAssignmentDifference(
        persistedDisabledByIdentity,
        disabledByIdentity,
      );
      if (newlyDisabledAssignments.length + reenabledAssignments.length > 1) {
        throw new ChorePlanPreviewError(
          'Change one disabled assignment at a time.',
          400,
        );
      }
      if (
        !plan &&
        (newlyDisabledAssignments.length || reenabledAssignments.length)
      ) {
        throw new ChorePlanPreviewError(
          'Create the chore plan before changing individual assignments.',
          409,
        );
      }

      const persistedSlots = plan
        ? await loadPersistedSlots(transaction, plan.id)
        : [];
      const persistedAssignments = storedAssignmentMap(persistedSlots);
      const previewAssignments = chorePlanPreviewAssignmentMap(preview);
      const removedAssignments = chorePlanAssignmentDifference(
        persistedAssignments,
        previewAssignments,
      );
      const addedAssignments = chorePlanAssignmentDifference(
        previewAssignments,
        persistedAssignments,
      );
      const assignmentCounts = await loadAssignmentCounts(transaction, [
        ...new Set(persistedSlots.map(({ shiftID }) => shiftID)),
      ]);
      const hasParticipantAssignments = [...assignmentCounts.values()].some(
        (count) => count > 0,
      );
      let trackedAddedAssignments: ChorePlanDisabledAssignment[] = [];

      if (plan && newlyDisabledAssignments.length) {
        if (!planInputsMatchRequest(plan, input)) {
          throw new ChorePlanPreviewError(
            'Apply plan input changes before disabling an assignment.',
            409,
          );
        }
        const [disabledAssignment] = newlyDisabledAssignments;
        const disabledSlot = persistedAssignments.get(
          disabledAssignmentIdentity(disabledAssignment),
        );
        if (
          !disabledSlot ||
          removedAssignments.length !== 1 ||
          disabledAssignmentIdentity(removedAssignments[0]) !==
            disabledAssignmentIdentity(disabledAssignment) ||
          addedAssignments.length !== 1 ||
          !previewCapacitiesAreSafe(preview, persistedSlots, assignmentCounts)
        ) {
          throw new ChorePlanPreviewError(
            'That assignment cannot be disabled safely.',
            409,
          );
        }
        const shiftCapacity = persistedSlots.filter(
          ({ shiftID }) => shiftID === disabledSlot.shiftID,
        ).length;
        if (
          (assignmentCounts.get(disabledSlot.shiftID) ?? 0) >= shiftCapacity
        ) {
          throw new ChorePlanPreviewError(
            'Only an empty assignment can be disabled.',
            409,
          );
        }
        if (plan.openedAt !== null) {
          const addedAfterOpening = await transaction(
            'chore_plan_admin_added_assignments',
          )
            .where({
              chorePlanID: plan.id,
              shiftKey: disabledAssignment.shiftKey,
              definitionKey: disabledAssignment.definitionKey,
              addedAfterOpening: true,
            })
            .first();
          if (!addedAfterOpening) {
            throw new ChorePlanPreviewError(
              'After signups open, only empty assignments added by a plan update can be disabled.',
              409,
            );
          }
        }
        trackedAddedAssignments = addedAssignments;
      } else if (plan && reenabledAssignments.length) {
        if (!planInputsMatchRequest(plan, input)) {
          throw new ChorePlanPreviewError(
            'Apply plan input changes before re-enabling an assignment.',
            409,
          );
        }
        const [reenabledAssignment] = reenabledAssignments;
        const eligibilityPlanID = plan.id;
        const planOpenedAt = plan.openedAt;
        if (
          addedAssignments.length !== 1 ||
          disabledAssignmentIdentity(addedAssignments[0]) !==
            disabledAssignmentIdentity(reenabledAssignment) ||
          removedAssignments.length !== 1 ||
          !previewCapacitiesAreSafe(preview, persistedSlots, assignmentCounts)
        ) {
          throw new ChorePlanPreviewError(
            'That assignment cannot be re-enabled safely.',
            409,
          );
        }
        const reenabledKind = reenabledAssignment.shiftKey.split('|')[0];
        const activeAddedAssignments =
          (await transaction<AdminAddedAssignmentRow>(
            'chore_plan_admin_added_assignments',
          )
            .select(
              'id',
              'chorePlanID',
              'shiftKey',
              'definitionKey',
              'addedAfterOpening',
              'createdAt',
            )
            .where({ chorePlanID: eligibilityPlanID })
            .orderBy('createdAt', 'desc')
            .orderBy('id', 'desc')) as AdminAddedAssignmentRow[];
        const removableAssignment = activeAddedAssignments.find(
          (assignment) => {
            const slot = persistedAssignments.get(
              disabledAssignmentIdentity(assignment),
            );
            if (
              !slot ||
              slot.kind !== reenabledKind ||
              (planOpenedAt !== null && !assignment.addedAfterOpening)
            ) {
              return false;
            }
            const shiftCapacity = persistedSlots.filter(
              ({ shiftID }) => shiftID === slot.shiftID,
            ).length;
            return (assignmentCounts.get(slot.shiftID) ?? 0) < shiftCapacity;
          },
        );
        if (
          !removableAssignment ||
          disabledAssignmentIdentity(removableAssignment) !==
            disabledAssignmentIdentity(removedAssignments[0])
        ) {
          throw new ChorePlanPreviewError(
            'That assignment cannot be re-enabled because there is no empty assignment from the latest plan update to remove.',
            409,
          );
        }
      } else if (plan?.status === 'open') {
        const existingCamperCount = plan.camperCount;
        const previousTargets = requirementsFromPlan(plan);
        const requirementsChanged = (
          ['chore', 'event', 'dinner'] as const
        ).some((kind) => input.requirements[kind] !== previousTargets[kind]);
        const reducesCapacity = (['chore', 'event', 'dinner'] as const).some(
          (kind) =>
            preview.categories[kind].target <
            existingCamperCount * previousTargets[kind],
        );
        if (
          input.camperCount <= existingCamperCount ||
          requirementsChanged ||
          reducesCapacity ||
          removedAssignments.length > 0 ||
          !previewCapacitiesAreSafe(preview, persistedSlots, assignmentCounts)
        ) {
          throw new ChorePlanPreviewError(
            'An open chore plan can only increase its camper count; requirements, existing assignments, and existing slots must remain unchanged.',
            409,
          );
        }
        trackedAddedAssignments = addedAssignments;
      } else if (plan) {
        if (hasParticipantAssignments) {
          throw new ChorePlanPreviewError(
            'A draft with participant assignments cannot be replaced.',
            409,
          );
        }
        trackedAddedAssignments = addedAssignments;
      }

      if (plan) {
        const incompatibleOverride = await transaction(
          'chore_plan_requirement_overrides',
        )
          .select('userID')
          .where({ chorePlanID: plan.id })
          .andWhere((query) =>
            query
              .where('choreRequirement', '>', preview.requirements.chore)
              .orWhere('eventRequirement', '>', preview.requirements.event)
              .orWhere('dinnerRequirement', '>', preview.requirements.dinner),
          )
          .first();
        if (incompatibleOverride) {
          throw new ChorePlanPreviewError(
            'A participant requirement override exceeds the replacement plan. Clear or reduce overrides before replacing it.',
            409,
          );
        }
      }

      const previousAuditSnapshot = plan
        ? auditSnapshot(
            plan,
            plan.generationHash,
            {
              ...preview,
              year: plan.planningYear,
              camperCount: plan.camperCount,
              requirements: requirementsFromPlan(plan),
              catalogRevision: String(plan.catalogRevision),
            },
            await loadDraftCounts(transaction, plan.id),
          )
        : null;
      const nextDraftRevision = plan
        ? nextRevision(String(plan.draftRevision))
        : '1';

      if (!plan) {
        [plan] = (await transaction<ChorePlanRow>('chore_plans')
          .insert({
            rosterID: input.rosterID,
            status: 'draft',
            planningYear: preview.year,
            camperCount: preview.camperCount,
            ...requirementsToColumns(preview.requirements),
            catalogRevision: preview.catalogRevision,
            draftRevision: nextDraftRevision,
            generationHash: hash,
          })
          .returning('*')) as ChorePlanRow[];
      }
      if (!plan) {
        throw new Error('The chore plan draft could not be created.');
      }
      const planID = plan.id;

      if (newlyDisabledAssignments.length) {
        await transaction('chore_plan_disabled_assignments').insert(
          newlyDisabledAssignments.map(({ shiftKey, definitionKey }) => ({
            chorePlanID: planID,
            shiftKey,
            definitionKey,
            disabledByUserID: actorUserID,
          })),
        );
      }
      if (reenabledAssignments.length) {
        const [reenabledAssignment] = reenabledAssignments;
        await transaction('chore_plan_disabled_assignments')
          .where({
            chorePlanID: planID,
            shiftKey: reenabledAssignment.shiftKey,
            definitionKey: reenabledAssignment.definitionKey,
          })
          .del();
      }
      await recordAddedAssignments(
        transaction,
        planID,
        trackedAddedAssignments,
        actorUserID,
        plan.openedAt !== null,
      );

      const existingSchedules = (await transaction<ScheduleRow>('schedules')
        .select('id', 'chorePlanID', 'plannerKey')
        .where({ chorePlanID: planID })
        .forUpdate()) as ScheduleRow[];
      if (existingSchedules.some(({ plannerKey }) => !plannerKey)) {
        throw new Error('A generated schedule is missing its stable key.');
      }
      const existingScheduleIDs = existingSchedules.map(({ id }) => id);
      const existingShifts = existingScheduleIDs.length
        ? ((await transaction<ShiftRow>('shifts')
            .select('id', 'scheduleID', 'plannerKey')
            .whereIn('scheduleID', existingScheduleIDs)
            .forUpdate()) as ShiftRow[])
        : [];
      if (existingShifts.some(({ plannerKey }) => !plannerKey)) {
        throw new Error('A generated shift is missing its stable key.');
      }
      const scheduleDescriptors = [
        ...new Map(
          preview.shifts.map((shift) => [
            shift.scheduleKey,
            {
              rosterID: input.rosterID,
              name: shift.scheduleName,
              description: `Generated ${shift.kind} schedule for chore plan ${planID}.`,
              chorePlanID: planID,
              plannerKey: shift.scheduleKey,
            },
          ]),
        ).values(),
      ];
      const existingSchedulesByKey = new Map(
        existingSchedules.map((schedule) => [schedule.plannerKey, schedule]),
      );
      const scheduleEntries = await Promise.all(
        scheduleDescriptors.map(async (descriptor) => {
          const existing = existingSchedulesByKey.get(descriptor.plannerKey);
          if (existing) {
            await transaction('schedules').where({ id: existing.id }).update({
              rosterID: descriptor.rosterID,
              name: descriptor.name,
              description: descriptor.description,
            });
            return [descriptor.plannerKey, existing.id] as const;
          }
          const [created] = (await transaction('schedules')
            .insert(descriptor)
            .returning('id')) as IDRow[];
          return [descriptor.plannerKey, created.id] as const;
        }),
      );
      const schedulesByKey = new Map<string, number>(scheduleEntries);

      await transaction('chore_plan_generated_shifts')
        .where({ chorePlanID: planID })
        .del();

      const existingScheduleKeysByID = new Map(
        existingSchedules.map((schedule) => [schedule.id, schedule.plannerKey]),
      );
      const existingShiftsByKey = new Map(
        existingShifts.map((shift) => [
          `${existingScheduleKeysByID.get(shift.scheduleID)}|${shift.plannerKey}`,
          shift,
        ]),
      );
      const definitionsByKey = new Map<string, ChoreCatalogDefinitionView>(
        catalog.definitions.map((definition) => [
          definition.stableKey,
          definition,
        ]),
      );

      const generatedRows = await Promise.all(
        preview.shifts.map(async (shift) => {
          const scheduleID = schedulesByKey.get(shift.scheduleKey);
          if (!scheduleID) {
            throw new Error(
              `Generated schedule ${shift.scheduleKey} could not be loaded.`,
            );
          }
          const existing = existingShiftsByKey.get(
            `${shift.scheduleKey}|${shift.stableKey}`,
          );
          let shiftID: number;
          if (existing) {
            shiftID = existing.id;
            await transaction('shifts')
              .where({ id: shiftID })
              .update({
                scheduleID,
                plannerKey: shift.stableKey,
                startTime: new Date(shift.startTime),
                endTime: new Date(shift.endTime),
                requiredParticipants: shift.requiredParticipants,
              });
          } else {
            const [created] = (await transaction('shifts')
              .insert({
                scheduleID,
                plannerKey: shift.stableKey,
                startTime: new Date(shift.startTime),
                endTime: new Date(shift.endTime),
                requiredParticipants: shift.requiredParticipants,
              })
              .returning('id')) as IDRow[];
            shiftID = created.id;
          }

          const generatedShift: GeneratedShiftInsert = {
            shiftID,
            chorePlanID: planID,
            stableKey: shift.stableKey,
            scheduleKey: shift.scheduleKey,
            kind: shift.kind,
            scheduleName: shift.scheduleName,
            displayDayNumber: shift.displayDayNumber,
            displayDayLabel: shift.displayDayLabel,
            calendarDay: shift.calendarDay,
            timePeriodLabel: shift.timePeriodLabel,
            periodOrder: shift.periodOrder,
            totalScore: shift.totalScore,
          };
          const slots = shift.slots.map((slot, slotOrder) => {
            const definition = definitionsByKey.get(slot.definitionKey);
            if (
              !definition ||
              definition.kind !== shift.kind ||
              definition.positionLabel !== slot.positionLabel ||
              definition.score !== slot.score
            ) {
              throw new Error(
                `Generated slot ${slot.definitionKey} does not match the catalog.`,
              );
            }
            const snapshot: SlotSnapshotInsert = {
              shiftID,
              slotOrder,
              definitionKey: definition.stableKey,
              kind: definition.kind,
              shiftLabel: definition.shiftLabel,
              positionLabel: definition.positionLabel,
              dayMode: definition.dayMode,
              dayNumber: definition.dayNumber,
              dayLabel: definition.dayLabel,
              timePeriodLabel: definition.timePeriodLabel,
              periodOrder: definition.periodOrder,
              startLocalTime: definition.startLocalTime,
              endLocalTime: definition.endLocalTime,
              endDayOffset: definition.endDayOffset,
              sourceOrder: definition.sourceOrder,
              score: definition.score,
            };
            return snapshot;
          });
          return { generatedShift, slots };
        }),
      );
      const retainedShiftIDs = new Set(
        generatedRows.map(({ generatedShift }) => generatedShift.shiftID),
      );
      const generatedShiftRows = generatedRows.map(
        ({ generatedShift }) => generatedShift,
      );
      const slotSnapshotRows = generatedRows.flatMap(({ slots }) => slots);

      const removedShiftIDs = existingShifts
        .map(({ id }) => id)
        .filter((id) => !retainedShiftIDs.has(id));
      if (removedShiftIDs.length) {
        await transaction('shifts').whereIn('id', removedShiftIDs).del();
      }
      const retainedScheduleIDs = new Set(schedulesByKey.values());
      const removedScheduleIDs = existingSchedules
        .map(({ id }) => id)
        .filter((id) => !retainedScheduleIDs.has(id));
      if (removedScheduleIDs.length) {
        await transaction('schedules').whereIn('id', removedScheduleIDs).del();
      }

      if (generatedShiftRows.length) {
        await transaction('chore_plan_generated_shifts').insert(
          generatedShiftRows,
        );
      }
      if (slotSnapshotRows.length) {
        await transaction('chore_plan_slot_snapshots').insert(slotSnapshotRows);
      }

      await transaction('chore_plans')
        .where({ id: planID })
        .update({
          planningYear: preview.year,
          camperCount: preview.camperCount,
          ...requirementsToColumns(preview.requirements),
          catalogRevision: preview.catalogRevision,
          draftRevision: nextDraftRevision,
          generationHash: hash,
          updatedAt: transaction.fn.now(),
        });
      await transaction('chore_plan_audit_entries').insert({
        chorePlanID: planID,
        actorUserID,
        action: previousAuditSnapshot ? 'draft_replaced' : 'draft_applied',
        details: {
          previous: previousAuditSnapshot,
          current: auditSnapshot(
            { ...plan, draftRevision: nextDraftRevision },
            hash,
            preview,
            expectedCounts,
          ),
        },
      });

      plan = (await transaction<ChorePlanRow>('chore_plans')
        .where({ id: planID })
        .first()) as ChorePlanRow;
      const storedCounts = await loadDraftCounts(transaction, plan.id);
      if (
        storedCounts.scheduleCount !== expectedCounts.scheduleCount ||
        storedCounts.shiftCount !== expectedCounts.shiftCount ||
        storedCounts.slotCount !== expectedCounts.slotCount
      ) {
        throw new Error('The generated chore plan draft is incomplete.');
      }

      return {
        changed: true,
        replaced: previousAuditSnapshot !== null,
        draft: draftSummary(plan, storedCounts, disabledAssignments),
        preview: await withChorePlanAssignmentEligibility(
          transaction,
          plan,
          preview,
          build,
        ),
      };
    });
  }
}
