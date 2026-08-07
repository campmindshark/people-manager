import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    TRUNCATE TABLE
      shift_participants,
      shifts,
      schedules,
      chore_plan_requirement_overrides,
      chore_plan_audit_entries,
      chore_plans
    RESTART IDENTITY
  `);
}

export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260805000000_reset_chore_planning_data is forward-only because deleted planning data cannot be reconstructed.',
    ),
  );
}
