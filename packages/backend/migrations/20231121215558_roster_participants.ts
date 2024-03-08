import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('roster_participants', (table) => {
    table.increments('id').primary();
    table.integer('rosterID');
    table.foreign('rosterID').references('id').inTable('rosters');
    table.integer('userID');
    table.foreign('userID').references('id').inTable('users');
    table.integer('probabilityOfAttending');
    table.boolean('hasTicket');
    table.boolean('hasVehiclePass');
    table.boolean('extraTickets');
    table.integer('yearsAttended');
    table.json('yearsAtCamp');
    table.date('estimatedArrivalDate');
    table.date('estimatedDepartureDate');
    table.string('sleepingArrangement');
    table.boolean('earlyArrivalInterest');
    table.boolean('postBurnInterest');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('roster_participants');
}
