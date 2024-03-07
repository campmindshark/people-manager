import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';
import UserController from '../controllers/user';
import PrivateProfile from '../models/user/user_private';

const router: Router = express.Router();

/* GET PrivateProfile for this user. */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedUser = req.user as User;
    const query = PrivateProfile.query().where('userID', authenticatedUser.id);

    const privateProfile = await query;

    if (privateProfile.length === 0) {
      res.json({ error: 'PrivateProfile not found' });
      return;
    }

    if (privateProfile.length > 1) {
      res.json({ error: 'too many PrivateProfiles found' });
      return;
    }

    res.json(privateProfile[0]);
  },
);

/* POST PrivateProfile for this user. */
router.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const authenticatedUser = req.user as User;

    const privateProfile: PrivateProfile = req.body;

    const currentPrivateProfileQuery = PrivateProfile.query().where(
      'userID',
      authenticatedUser.id,
    );
    const currentPrivateProfile = await currentPrivateProfileQuery;
    if (currentPrivateProfile.length === 0) {
      const createdPrivateProfile = await UserController.createPrivateProfile(
        privateProfile,
        authenticatedUser.id,
      );
      res.json(createdPrivateProfile);
      return;
    }

    const updatedPrivateProfile = await UserController.updatePrivateProfile(
      privateProfile,
      authenticatedUser.id,
    );

    res.json(updatedPrivateProfile);
  },
);

export default router;
