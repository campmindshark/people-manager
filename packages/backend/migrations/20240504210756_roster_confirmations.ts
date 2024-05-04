import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('roster_participants', (table) => {
    table.boolean('hasReadEssentialMindshark').defaultTo(false);
    table.boolean('agreesToParticipateInTearDown').defaultTo(false);
    table.boolean('agreesToParticipateInShifts').defaultTo(false);
    table.boolean('agreesToPayDues').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('roster_participants', (table) => {
    table.dropColumn('hasReadEssentialMindshark');
    table.dropColumn('agreesToParticipateInTearDown');
    table.dropColumn('agreesToParticipateInShifts');
    table.dropColumn('agreesToPayDues');
  });
}
