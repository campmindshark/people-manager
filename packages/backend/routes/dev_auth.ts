import express, { Request, Response, Router } from 'express';
import Knex from 'knex';
import User from '../models/user/user';
import { getConfig } from '../config/config';
import knexConfig from '../knexfile';

const config = getConfig();
const knex = Knex(knexConfig[config.Environment]);
const router: Router = express.Router();

const DEV_USERS: Record<
  string,
  {
    googleID: string;
    firstName: string;
    lastName: string;
    email: string;
    isAdmin: boolean;
  }
> = {
  admin: {
    googleID: 'dev-admin',
    firstName: 'Dev',
    lastName: 'Admin',
    email: 'dev-admin@localhost',
    isAdmin: true,
  },
  standard: {
    googleID: 'dev-user',
    firstName: 'Dev',
    lastName: 'User',
    email: 'dev-user@localhost',
    isAdmin: false,
  },
};

router.get('/status', (_req: Request, res: Response) => {
  res.json({ available: config.DevAuthBypass });
});

router.get('/login/:role', async (req: Request, res: Response) => {
  if (!config.DevAuthBypass) {
    res.status(404).send('Not found');
    return;
  }

  const { role } = req.params;
  const devUser = DEV_USERS[role];
  if (!devUser) {
    res.status(400).json({ error: 'Invalid role. Use "admin" or "standard".' });
    return;
  }

  try {
    let user = await User.query().where('googleID', devUser.googleID).first();

    if (!user) {
      user = await User.query().insert({
        googleID: devUser.googleID,
        firstName: devUser.firstName,
        lastName: devUser.lastName,
        email: devUser.email,
        phoneNumber: '555-0100',
        location: 'Local Dev',
      });
    }

    if (devUser.isAdmin) {
      const existingRole = await knex('user_roles')
        .where({ userID: user.id, roleID: 1 })
        .first();
      if (!existingRole) {
        await knex('user_roles').insert({ userID: user.id, roleID: 1 });
      }
    }

    req.login(user, (err) => {
      if (err) {
        console.error('Dev auth login error:', err);
        res.status(500).json({ error: 'Failed to establish session' });
        return;
      }
      res.redirect(`${config.FrontendURL}/`);
    });
  } catch (err) {
    console.error('Dev auth error:', err);
    res.status(500).json({ error: 'Dev auth failed' });
  }
});

export default router;
