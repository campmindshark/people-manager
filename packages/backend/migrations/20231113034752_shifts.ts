import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('shifts', (table) => {
    table.increments('id').primary();
    table.integer('scheduleID');
    table.foreign('scheduleID').references('id').inTable('schedules');
    table.date('startTime');
    table.date('endTime');
    table.integer('requiredParticipants');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('shifts');
}
