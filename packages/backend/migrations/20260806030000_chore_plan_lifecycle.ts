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
        'plan_reopened'
      )
    ),
    ADD CONSTRAINT "chore_plan_audit_entries_lifecycle_details_valid"
    CHECK (
      "action" NOT IN ('plan_opened', 'plan_closed', 'plan_reopened')
      OR (
        jsonb_typeof("details") = 'object'
        AND (
          (
            "action" = 'plan_opened'
            AND "details" = '{"fromStatus":"draft","toStatus":"open"}'::jsonb
          )
          OR (
            "action" = 'plan_closed'
            AND "details" = '{"fromStatus":"open","toStatus":"closed"}'::jsonb
          )
          OR (
            "action" = 'plan_reopened'
            AND jsonb_exists("details", 'reason')
            AND "details" - 'reason' =
              '{"fromStatus":"closed","toStatus":"open"}'::jsonb
            AND jsonb_typeof("details" -> 'reason') = 'string'
            AND char_length("details" ->> 'reason') BETWEEN 1 AND 500
            AND "details" ->> 'reason' !~ '(^[[:space:]])|([[:space:]]$)'
          )
        )
      )
    )
  `);
}

// Lifecycle audit rows are application data. Any future replacement must use
// a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806030000_chore_plan_lifecycle is forward-only because lifecycle audit rows are application data.',
    ),
  );
}
