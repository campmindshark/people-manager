import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chore_plans', (table) => {
    table.increments('id').primary();
    table.integer('rosterID').notNullable().unique();
    table.foreign('rosterID').references('rosters.id');
    table.integer('camperCount').notNullable();
    table.text('sheetUrl').notNullable();
    table.string('sheetTitle').notNullable();
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('schedules', (table) => {
    table.integer('chorePlanID').nullable();
    table.foreign('chorePlanID').references('chore_plans.id');
    table.text('plannerKey').nullable();
    table.unique(
      ['chorePlanID', 'plannerKey'],
      'schedules_chore_plan_key_unique',
    );
  });

  await knex.schema.alterTable('shifts', (table) => {
    table.text('plannerKey').nullable();
    table.unique(['scheduleID', 'plannerKey'], 'shifts_planner_key_unique');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shifts', (table) => {
    table.dropUnique(['scheduleID', 'plannerKey'], 'shifts_planner_key_unique');
    table.dropColumn('plannerKey');
  });

  await knex.schema.alterTable('schedules', (table) => {
    table.dropUnique(
      ['chorePlanID', 'plannerKey'],
      'schedules_chore_plan_key_unique',
    );
    table.dropForeign('chorePlanID');
    table.dropColumn('plannerKey');
    table.dropColumn('chorePlanID');
  });

  await knex.schema.dropTableIfExists('chore_plans');
}
