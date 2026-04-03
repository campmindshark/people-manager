import express, { Request, Response, Router } from 'express';
import User from '../models/user/user';
import { getConfig } from '../config/config';

const config = getConfig();
const router: Router = express.Router();

const DEV_GOOGLE_IDS: Record<string, string> = {
  admin: 'dev-admin',
  standard: 'dev-user',
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
  const googleID = DEV_GOOGLE_IDS[role];
  if (!googleID) {
    res.status(400).json({ error: 'Invalid role. Use "admin" or "standard".' });
    return;
  }

  try {
    const user = await User.query().where('googleID', googleID).first();

    if (!user) {
      res.status(404).json({
        error: `Dev user "${role}" not found. Run migrations first: yarn db-migrate`,
      });
      return;
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
