import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('shift_participants', (table) => {
    table.increments('id').primary();
    table.integer('shiftID');
    table.foreign('shiftID').references('id').inTable('shifts');
    table.integer('userID');
    table.foreign('userID').references('id').inTable('users');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('shift_participants');
}
