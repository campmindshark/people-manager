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
  // Deleted planning data cannot be reconstructed during a rollback.
  return Promise.resolve();
}
