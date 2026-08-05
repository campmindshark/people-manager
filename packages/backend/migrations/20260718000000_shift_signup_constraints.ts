import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DELETE FROM shift_participants AS duplicate
    USING shift_participants AS original
    WHERE duplicate.id > original.id
      AND duplicate."shiftID" = original."shiftID"
      AND duplicate."userID" = original."userID"
  `);

  await knex.schema.alterTable('shift_participants', (table) => {
    table.unique(['shiftID', 'userID'], 'shift_participants_shift_user_unique');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('shift_participants', (table) => {
    table.dropUnique(
      ['shiftID', 'userID'],
      'shift_participants_shift_user_unique',
    );
  });
}
