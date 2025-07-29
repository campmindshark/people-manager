import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import User from '../models/user/user';
import { getConfig } from '../config/config';

const config = getConfig();
const router: Router = express.Router();

router.get('/login/success', async (req: Request, res) => {
  if (req.user && req.isAuthenticated()) {
    const query = User.query().findById(req.user.id);
    const user = await query;

    if (user && user.isBlocked) {
      res.status(403).json({
        success: false,
        message: 'user account is blocked',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'successful',
      user,
    });

    return;
  }

  res.status(401).json({
    success: false,
    message: 'user not authenticated',
  });
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
