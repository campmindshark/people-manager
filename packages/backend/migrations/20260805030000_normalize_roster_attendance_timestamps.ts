import { Knex } from 'knex';

const FIRST_AFFECTED_ROSTER_YEAR = 2026;

export async function up(knex: Knex): Promise<void> {
  // The legacy roster route received absolute ISO timestamps, read their UTC
  // wall clocks, and then reinterpreted those wall clocks as Pacific Time.
  // Restore the original instants for active and future rosters before their
  // attendance windows are enforced, without rewriting historical records
  // that may predate that route behavior.
  await knex('roster_participants')
    .whereIn(
      'rosterID',
      knex('rosters')
        .select('id')
        .where('year', '>=', FIRST_AFFECTED_ROSTER_YEAR),
    )
    .update({
      estimatedArrivalDate: knex.raw(
        "timezone('UTC', timezone('America/Los_Angeles', ??))",
        ['estimatedArrivalDate'],
      ),
      estimatedDepartureDate: knex.raw(
        "timezone('UTC', timezone('America/Los_Angeles', ??))",
        ['estimatedDepartureDate'],
      ),
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex('roster_participants')
    .whereIn(
      'rosterID',
      knex('rosters')
        .select('id')
        .where('year', '>=', FIRST_AFFECTED_ROSTER_YEAR),
    )
    .update({
      estimatedArrivalDate: knex.raw(
        "timezone('America/Los_Angeles', timezone('UTC', ??))",
        ['estimatedArrivalDate'],
      ),
      estimatedDepartureDate: knex.raw(
        "timezone('America/Los_Angeles', timezone('UTC', ??))",
        ['estimatedDepartureDate'],
      ),
    });
}
