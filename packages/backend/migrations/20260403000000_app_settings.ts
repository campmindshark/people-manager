import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('app_settings', (table) => {
    table.increments('id').primary();
    table.string('key').unique().notNullable();
    table.string('value').notNullable();
    table.timestamps(true, true);
  });

  await knex('app_settings')
    .insert({ key: 'active_roster_id', value: '2' })
    .onConflict('key')
    .ignore();
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('app_settings');
}
