import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_roles', (table) => {
    table.increments('id').primary();
    table.integer('userID');
    table.foreign('userID').references('id').inTable('users');
    table.integer('roleID');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_roles');
}
