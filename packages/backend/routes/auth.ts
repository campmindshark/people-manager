import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import User from '../models/user/user';
import { getConfig } from '../config/config';

const config = getConfig();
const router: Router = express.Router();

interface UserRequest extends Request {
  user?: any;
}

router.get('/login/success', async (req: UserRequest, res) => {
  if (req.user && req.isAuthenticated()) {
    const query = User.query().where('googleID', req.user.id);

    const appUsers = await query;
    if (appUsers.length !== 1) {
      console.log(
        `issue querying the DB for the current user... google_id: ${req.user.id}, displayName: ${req.user.displayName} , appUsers.length: ${appUsers.length}`,
      );
      res.status(401).json({
        success: false,
        message: 'user not authenticated',
      });
    }

    res.status(200).json({
      success: true,
      message: 'successful',
      user: appUsers[0],
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'user not authenticated',
    });
  }
});

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/error' }),
  (req, res) => {
    // Successful authentication, redirect success.
    res.redirect(`${config.FrontendURL}/`);
  },
);

router.get('/logout', (req: Request, res: Response) => {
  // eslint-disable-next-line consistent-return
  req.logOut((err) => {
    if (err) {
      return console.log(err);
    }
    console.log(`-------> User Logged out`);
  });
  res.redirect(`${config.FrontendURL}/login`);
});

export default router;
