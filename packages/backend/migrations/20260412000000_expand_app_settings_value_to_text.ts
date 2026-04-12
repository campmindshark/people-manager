import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('app_settings', (table) => {
    table.text('value').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('app_settings', (table) => {
    table.string('value').notNullable().alter();
  });
}
