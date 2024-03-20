import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';
import UserController from '../controllers/user';
import PrivateProfile from '../models/user/user_private';
import RosterParticipant from '../models/roster_participant/roster_participant';
import ShiftController from 'controllers/shift';

const router: Router = express.Router();

/* GET all users. */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = User.query();

    const users = await query;
    res.json(users);
  },
);

/* GET PrivateProfile for this user. */
router.get(
  '/private',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedUser = req.user as User;
    const query = PrivateProfile.query().where('userID', authenticatedUser.id);

    const users = await query;
    res.json(users);
  },
);

/* GET user by ID. */
router.get(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = User.query().findById(req.params.id);

    const users = await query;
    res.json(users);
  },
);

router.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const authenticatedUser = req.user as User;

    const userUpdate: User = req.body;

    const updatedUser = await UserController.updateUser(
      userUpdate,
      authenticatedUser.id,
    );

    res.json(updatedUser);
  },
);

/* GET the users signup status in the context of a roster by ID. */
router.get(
  '/:userID/signup-status/:rosterID',
  async (req: Request, res: Response) => {
    const [rosterID, userID] = [req.params.rosterID, req.params.userID];
    const tmpResponse: SignupStatus = {
      userID: parseInt(userID),
      hasSignedUpForRoster: false,
      rosterID: parseInt(rosterID),
      hasCompletedPrivateProfile: false,
      hasCompletedPublicProfile: false,
      hasPaidDues: false,
      shiftCount: 0,
    };

    // Get the user profile to determine if its been completed
    const user = await User.query().findById(userID);
    if (!user) {
      res.json({ error: 'User not found' });
      return;
    }
    if (user.hasCompletedProfile()) {
      tmpResponse.hasCompletedPublicProfile = true;
    }

    // Get the user's private profile to determine if its been completed
    const privateProfile = await PrivateProfile.query().where('userID', userID);
    if (privateProfile.length > 0) {
      tmpResponse.hasCompletedPrivateProfile = true;
    }

    // Get the roster participant entry to confirm if they've signed up
    const rosterParticipant = await RosterParticipant.query()
      .where({ userID, rosterID })
      .first();
    if (rosterParticipant) {
      tmpResponse.hasSignedUpForRoster = true;
    }

    res.json(tmpResponse);
  },
);

export default router;
