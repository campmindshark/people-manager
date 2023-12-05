import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('rosters', (table) => {
    table.increments('id').primary();
    table.integer('year');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('rosters');
}
