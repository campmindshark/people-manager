/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';

const DEV_USERS = [
  {
    googleID: 'dev-admin',
    firstName: 'Dev',
    lastName: 'Admin',
    email: 'dev-admin@localhost',
    phoneNumber: '555-0100',
    location: 'Local Dev',
    isAdmin: true,
  },
  {
    googleID: 'dev-user',
    firstName: 'Dev',
    lastName: 'User',
    email: 'dev-user@localhost',
    phoneNumber: '555-0100',
    location: 'Local Dev',
    isAdmin: false,
  },
];

async function upsertDevUser(
  knex: Knex,
  user: (typeof DEV_USERS)[number],
): Promise<void> {
  const { isAdmin, ...userData } = user;

  const existing = await knex('users')
    .where({ googleID: userData.googleID })
    .first();

  let userId: number;
  if (existing) {
    userId = existing.id;
  } else {
    const [inserted] = await knex('users').insert(userData).returning('id');
    userId = inserted.id;
  }

  if (isAdmin) {
    const existingRole = await knex('user_roles')
      .where({ userID: userId, roleID: 1 })
      .first();
    if (!existingRole) {
      await knex('user_roles').insert({ userID: userId, roleID: 1 });
    }
  }
}

export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  for (let i = 0; i < DEV_USERS.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await upsertDevUser(knex, DEV_USERS[i]);
  }
}
