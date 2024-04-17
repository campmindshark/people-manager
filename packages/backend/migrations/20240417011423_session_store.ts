import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('session', (table) => {
    table.string('sid').primary();
    table.json('sess').notNullable();
    table.timestamp('expire').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('session');
}
