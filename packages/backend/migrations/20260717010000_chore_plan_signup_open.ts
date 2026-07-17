import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chore_plans', (table) => {
    table.timestamp('signupsOpenedAt', { useTz: true }).nullable();
  });

  await knex('chore_plans').update({ signupsOpenedAt: knex.fn.now() });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chore_plans', (table) => {
    table.dropColumn('signupsOpenedAt');
  });
}
