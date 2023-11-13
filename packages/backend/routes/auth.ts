import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import { getConfig } from '../config/config';

const config = getConfig();
const router: Router = express.Router();

router.get('/login/success', (req, res) => {
  if (req.user && req.isAuthenticated()) {
    res.status(200).json({
      success: true,
      message: 'successful',
      user: req.user,
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
