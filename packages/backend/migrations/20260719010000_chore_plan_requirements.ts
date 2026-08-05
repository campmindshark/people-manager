import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chore_plans', (table) => {
    table.integer('choreRequirement').notNullable().defaultTo(3);
    table.integer('eventRequirement').notNullable().defaultTo(3);
    table.integer('dinnerRequirement').notNullable().defaultTo(1);
  });

  await knex.schema.createTable('chore_plan_requirement_overrides', (table) => {
    table.increments('id').primary();
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.integer('userID').notNullable();
    table.foreign('userID').references('users.id').onDelete('CASCADE');
    table.integer('choreRequirement').notNullable();
    table.integer('eventRequirement').notNullable();
    table.integer('dinnerRequirement').notNullable();
    table.text('reason').notNullable();
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(['chorePlanID', 'userID']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chore_plan_requirement_overrides');

  await knex.schema.alterTable('chore_plans', (table) => {
    table.dropColumn('dinnerRequirement');
    table.dropColumn('eventRequirement');
    table.dropColumn('choreRequirement');
  });
}
