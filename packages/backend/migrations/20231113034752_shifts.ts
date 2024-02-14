import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('shifts', (table) => {
    table.increments('id').primary();
    table.integer('scheduleID');
    table.foreign('scheduleID').references('id').inTable('schedules');
    table.dateTime('startTime', { useTz: false }); // always store in UTC
    table.dateTime('endTime');
    table.integer('requiredParticipants');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('shifts');
}
