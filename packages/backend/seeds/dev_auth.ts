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
  },
  {
    googleID: 'dev-user',
    firstName: 'Dev',
    lastName: 'User',
    email: 'dev-user@localhost',
    phoneNumber: '555-0100',
    location: 'Local Dev',
  },
];

const ADMIN_GOOGLE_ID = 'dev-admin';
const ADMIN_ROLE_ID = 1;

export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  for (let i = 0; i < DEV_USERS.length; i += 1) {
    const userData = DEV_USERS[i];
    // eslint-disable-next-line no-await-in-loop
    const existing = await knex('users')
      .where({ googleID: userData.googleID })
      .first();

    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await knex('users').insert(userData);
    }
  }

  const adminUser = await knex('users')
    .where({ googleID: ADMIN_GOOGLE_ID })
    .first();

  if (adminUser) {
    const existingRole = await knex('user_roles')
      .where({ userID: adminUser.id, roleID: ADMIN_ROLE_ID })
      .first();

    if (!existingRole) {
      await knex('user_roles').insert({
        userID: adminUser.id,
        roleID: ADMIN_ROLE_ID,
      });
    }
  }
}
