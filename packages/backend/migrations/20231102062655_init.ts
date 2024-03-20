import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('googleID');
    table.string('firstName');
    table.string('lastName');
    table.string('playaName');
    table.string('email');
    table.string('phoneNumber');
    table.string('location');
    table.string('referralName');
    table.json('skillsOfNote');
    table.string('skillsNotInList');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('users');
}
