import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('schedules', (table) => {
    table.increments('id').primary();
    table.integer('rosterID');
    table.foreign('rosterID').references('rosters.id');
    table.string('name');
    table.string('description');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('schedules');
}
