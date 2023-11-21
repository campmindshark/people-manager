import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('users').del();
  await knex('rosters').del();
  await knex('roster_participants').del();

  // Inserts seed entries
  await knex('rosters').insert([{ id: 1, year: 2024 }]);

  await knex('users').insert([
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@gmail.com',
      googleID: '123',
    },
    {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@gmail.com',
      googleID: '124',
    },
  ]);

  await knex('roster_participants').insert([
    { rosterID: 1, userID: 1 },
    { rosterID: 1, userID: 2 },
  ]);
}
