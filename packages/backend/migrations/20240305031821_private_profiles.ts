import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('private_profiles', (table) => {
    table.increments('id').primary();
    table.integer('userID');
    table.foreign('userID').references('id').inTable('users');
    table.string('emergencyContactName');
    table.string('emergencyContactPhone');
    table.string('medications');
    table.string('allergies');
    table.string('dietaryRestrictions');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('private_profiles');
}
