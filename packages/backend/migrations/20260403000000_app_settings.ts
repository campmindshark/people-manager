import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('app_settings', (table) => {
    table.increments('id').primary();
    table.string('key').unique().notNullable();
    table.string('value').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('app_settings');
}
