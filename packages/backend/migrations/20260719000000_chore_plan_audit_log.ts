import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chore_plan_audit_entries', (table) => {
    table.increments('id').primary();
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.integer('actorUserID').nullable();
    table.foreign('actorUserID').references('users.id').onDelete('SET NULL');
    table.string('actorName').notNullable();
    table.string('action').notNullable();
    table.jsonb('details').notNullable();
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(['chorePlanID', 'createdAt']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chore_plan_audit_entries');
}
