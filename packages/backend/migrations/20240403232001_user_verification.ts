import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_verifications', (table) => {
    table.increments('id').primary();
    table.integer('userID');
    table.foreign('userID').references('id').inTable('users');
    table.boolean('isVerified').defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_verifications');
}
