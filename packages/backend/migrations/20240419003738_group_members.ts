import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('group_members', (table) => {
    table.integer('userID');
    table.integer('groupID');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('group_members');
}
