import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('dues_payments', (table) => {
    table.increments('id').primary();
    table.integer('userID').notNullable();
    table.foreign('userID').references('id').inTable('users');
    table.integer('rosterID').notNullable();
    table.foreign('rosterID').references('id').inTable('rosters');
    table.boolean('paid').defaultTo(false);
    table.string('amount');
    table.string('paymentMethod');
    table.timestamp('paymentDate');
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('dues_payments');
}

