import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chore_plan_disabled_assignments', (table) => {
    table.increments('id').primary();
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.text('shiftKey').notNullable();
    table.text('definitionKey').notNullable();
    table.integer('disabledByUserID').notNullable();
    table.foreign('disabledByUserID').references('users.id');
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(
      ['chorePlanID', 'shiftKey', 'definitionKey'],
      'chore_plan_disabled_assignments_plan_key_unique',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_plan_disabled_assignments"
    ADD CONSTRAINT "chore_plan_disabled_assignments_keys_valid"
    CHECK (
      "shiftKey" ~ '^(chore|event|dinner)\\|[1-8]\\|[a-z0-9]+(-[a-z0-9]+)*$'
      AND "definitionKey" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  `);
}

// Disabled assignments are planning decisions. They must survive future
// camper-count changes, so this migration is forward-only like the draft
// persistence schema.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260809000000_chore_plan_disabled_assignments is forward-only because disabled assignments are application data.',
    ),
  );
}
