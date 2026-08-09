import { Knex } from 'knex';
import { ChoreCatalogKind } from '../view_models/chore_catalog';
import {
  ChorePlanDisabledAssignment,
  ChorePlanPreview,
} from '../view_models/chore_plan_preview';

export interface ChorePlanAssignmentEligibilityPlan {
  id: number;
  status: 'draft' | 'open' | 'closed';
  openedAt: Date | string | null;
}

interface StoredSlotRow extends ChorePlanDisabledAssignment {
  shiftID: number;
  kind: ChoreCatalogKind;
}

interface AddedAssignmentRow extends ChorePlanDisabledAssignment {
  id: number;
  chorePlanID: number;
  addedAfterOpening: boolean;
  createdAt: Date | string;
}

interface AssignmentCountRow {
  shiftID: number;
  count: string;
}

export function chorePlanAssignmentIdentity(
  assignment: ChorePlanDisabledAssignment,
): string {
  return `${assignment.shiftKey}|${assignment.definitionKey}`;
}

export function chorePlanPreviewAssignmentMap(
  preview: ChorePlanPreview,
): Map<string, ChorePlanDisabledAssignment & { kind: ChoreCatalogKind }> {
  return new Map(
    preview.shifts.flatMap((shift) =>
      shift.slots.map((slot) => {
        const assignment = {
          shiftKey: shift.stableKey,
          definitionKey: slot.definitionKey,
          kind: shift.kind,
        };
        return [chorePlanAssignmentIdentity(assignment), assignment] as const;
      }),
    ),
  );
}

export function chorePlanAssignmentDifference(
  first: Map<string, ChorePlanDisabledAssignment>,
  second: Map<string, ChorePlanDisabledAssignment>,
): ChorePlanDisabledAssignment[] {
  return [...first]
    .filter(([identity]) => !second.has(identity))
    .map(([, assignment]) => ({
      shiftKey: assignment.shiftKey,
      definitionKey: assignment.definitionKey,
    }));
}

async function storedSlots(
  database: Knex,
  chorePlanID: number,
): Promise<StoredSlotRow[]> {
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
    .where('generated.chorePlanID', chorePlanID)) as StoredSlotRow[];
}

async function assignmentCounts(
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

function capacitiesAreSafe(
  preview: ChorePlanPreview,
  slots: StoredSlotRow[],
  counts: Map<number, number>,
): boolean {
  const capacityByShiftKey = new Map(
    preview.shifts.map((shift) => [shift.stableKey, shift.slots.length]),
  );
  const shiftKeyByID = new Map(
    slots.map(({ shiftID, shiftKey }) => [shiftID, shiftKey]),
  );
  return [...counts].every(
    ([shiftID, count]) =>
      count <= (capacityByShiftKey.get(shiftKeyByID.get(shiftID) ?? '') ?? 0),
  );
}

export async function withChorePlanAssignmentEligibility(
  database: Knex,
  plan: ChorePlanAssignmentEligibilityPlan | undefined,
  preview: ChorePlanPreview,
  previewWithDisabledAssignments: (
    disabledAssignments: ChorePlanDisabledAssignment[],
  ) => ChorePlanPreview,
): Promise<ChorePlanPreview> {
  if (!plan || plan.status === 'closed') {
    return preview;
  }

  const slots = await storedSlots(database, plan.id);
  const shiftIDs = [...new Set(slots.map(({ shiftID }) => shiftID))];
  const [counts, addedAssignments] = await Promise.all([
    assignmentCounts(database, shiftIDs),
    database<AddedAssignmentRow>('chore_plan_admin_added_assignments')
      .select(
        'id',
        'chorePlanID',
        'shiftKey',
        'definitionKey',
        'addedAfterOpening',
        'createdAt',
      )
      .where({ chorePlanID: plan.id })
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc') as Promise<AddedAssignmentRow[]>,
  ]);
  const slotsByIdentity = new Map(
    slots.map((slot) => [chorePlanAssignmentIdentity(slot), slot]),
  );
  const capacityByShiftID = new Map<number, number>();
  slots.forEach(({ shiftID }) => {
    capacityByShiftID.set(shiftID, (capacityByShiftID.get(shiftID) ?? 0) + 1);
  });
  const activeAddedAssignments = addedAssignments.filter((assignment) => {
    const slot = slotsByIdentity.get(chorePlanAssignmentIdentity(assignment));
    return (
      slot &&
      (plan.openedAt === null || assignment.addedAfterOpening) &&
      (counts.get(slot.shiftID) ?? 0) <
        (capacityByShiftID.get(slot.shiftID) ?? 0)
    );
  });

  const disableableAssignments = slots
    .filter((slot) => {
      const hasEmptyCapacity =
        (counts.get(slot.shiftID) ?? 0) <
        (capacityByShiftID.get(slot.shiftID) ?? 0);
      if (!hasEmptyCapacity) {
        return false;
      }
      return (
        plan.openedAt === null ||
        activeAddedAssignments.some(
          (assignment) =>
            chorePlanAssignmentIdentity(assignment) ===
            chorePlanAssignmentIdentity(slot),
        )
      );
    })
    .map(({ shiftKey, definitionKey }) => ({ shiftKey, definitionKey }));

  const currentAssignments = new Map(
    slots.map((slot) => [chorePlanAssignmentIdentity(slot), slot]),
  );
  const reenableableAssignments = preview.disabledAssignments.filter(
    (disabledAssignment) => {
      const disabledSlot = preview.disabledSlots.find(
        (slot) =>
          chorePlanAssignmentIdentity(slot) ===
          chorePlanAssignmentIdentity(disabledAssignment),
      );
      if (!disabledSlot) {
        return false;
      }
      const removable = activeAddedAssignments.find((assignment) => {
        const slot = slotsByIdentity.get(
          chorePlanAssignmentIdentity(assignment),
        );
        return slot?.kind === disabledSlot.kind;
      });
      if (!removable) {
        return false;
      }
      const prospective = previewWithDisabledAssignments(
        preview.disabledAssignments.filter(
          (assignment) =>
            chorePlanAssignmentIdentity(assignment) !==
            chorePlanAssignmentIdentity(disabledAssignment),
        ),
      );
      const prospectiveAssignments = chorePlanPreviewAssignmentMap(prospective);
      const removedAssignments = chorePlanAssignmentDifference(
        currentAssignments,
        prospectiveAssignments,
      );
      const added = chorePlanAssignmentDifference(
        prospectiveAssignments,
        currentAssignments,
      );
      return (
        removedAssignments.length === 1 &&
        chorePlanAssignmentIdentity(removedAssignments[0]) ===
          chorePlanAssignmentIdentity(removable) &&
        added.length === 1 &&
        chorePlanAssignmentIdentity(added[0]) ===
          chorePlanAssignmentIdentity(disabledAssignment) &&
        capacitiesAreSafe(prospective, slots, counts)
      );
    },
  );

  return {
    ...preview,
    disableableAssignments,
    reenableableAssignments,
  };
}
