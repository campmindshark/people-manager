import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE "chore_plan_audit_entries"
    DROP CONSTRAINT "chore_plan_audit_entries_action_valid",
    ADD CONSTRAINT "chore_plan_audit_entries_action_valid"
    CHECK (
      "action" IN (
        'draft_applied',
        'draft_replaced',
        'plan_opened',
        'plan_closed',
        'plan_reopened',
        'admin_assignment_mutated'
      )
    ),
    ADD CONSTRAINT "chore_plan_audit_entries_admin_assignment_details_valid"
    CHECK (
      "action" <> 'admin_assignment_mutated'
      OR (
        jsonb_typeof("details") = 'object'
        AND jsonb_exists("details", 'operation')
        AND jsonb_exists("details", 'affectedAssignments')
        AND jsonb_exists("details", 'forced')
        AND jsonb_exists("details", 'reason')
        AND jsonb_exists("details", 'bypassedRules')
        AND "details" - ARRAY[
          'operation',
          'affectedAssignments',
          'forced',
          'reason',
          'bypassedRules'
        ]::text[] = '{}'::jsonb
        AND "details" ->> 'operation' IN ('assign', 'unassign', 'move', 'swap')
        AND jsonb_typeof("details" -> 'affectedAssignments') = 'array'
        AND jsonb_array_length("details" -> 'affectedAssignments') > 0
        AND jsonb_typeof("details" -> 'forced') = 'boolean'
        AND jsonb_typeof("details" -> 'bypassedRules') = 'array'
        AND (
          (
            ("details" ->> 'forced')::boolean = false
            AND "details" -> 'reason' = 'null'::jsonb
            AND "details" -> 'bypassedRules' = '[]'::jsonb
          )
          OR (
            ("details" ->> 'forced')::boolean = true
            AND jsonb_typeof("details" -> 'reason') = 'string'
            AND char_length(btrim("details" ->> 'reason')) BETWEEN 1 AND 500
          )
        )
      )
    )
  `);
}

// Administrative assignment audits are application data. Any replacement must
// use a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806040000_chore_plan_admin_assignments is forward-only because assignment audits are application data.',
    ),
  );
}
