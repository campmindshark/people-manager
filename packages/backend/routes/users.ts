import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';
import UserController from '../controllers/user';
import PrivateProfile from '../models/user/user_private';
import AnalysisController from '../controllers/analysis';
import hasPermission from '../middleware/rbac';
import UserVerification from '../models/user_verification/user_verification';

const router: Router = express.Router();

/* GET all users. */
router.get(
  '/',
  hasPermission('users:readAll'),
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

/* GET all unverified users. */
router.get(
  '/unverified',
  hasPermission('userVerification:readAll'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const users = await User.query();

    const promises: Promise<{
      user: User;
      isVerified: boolean;
    }>[] = [];
    for (let index = 0; index < users.length; index += 1) {
      const user = users[index];
      const func = async () => {
        const isVerified = await UserController.isVerified(user);
        return {
          user,
          isVerified,
        };
      };
      promises.push(func());
    }

    const results = await Promise.all(promises);
    const unverifiedUsers = results
      .filter((result) => !result.isVerified)
      .map((result) => result.user);

    res.json(unverifiedUsers);
  },
);

/* GET whether or not the user is verified. */
router.get(
  '/is-verified',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedUser = req.user as User;

    const isVerified = await UserController.isVerified(authenticatedUser);

    res.json(isVerified);
  },
);

/* GET user by ID. */
router.get(
  '/:id',
  hasPermission('users:readAll'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = User.query().findById(req.params.id);

    const users = await query;
    res.json(users);
  },
);

/* POST update this user. */
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

/* POST - verify this user. */
router.post(
  '/verify/:id',
  hasPermission('userVerification:edit'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const userID = req.params.id;

    const checkVerification = await UserVerification.query().findOne({
      userID: parseInt(userID, 10),
      isVerified: true,
    });

    if (checkVerification) {
      res.json(checkVerification);
      return;
    }

    const verification = await UserVerification.query().insert({
      userID: parseInt(userID, 10),
      isVerified: true,
    });

    res.json(verification);
  },
);

/* GET the users signup status in the context of a roster by ID. */
router.get(
  '/:userID/signup-status/:rosterID',
  hasPermission('signupStatus:readAll'),
  async (req: Request, res: Response) => {
    const [rosterID, userID] = [req.params.rosterID, req.params.userID];

    const status = await AnalysisController.GetSignupStatusForUser(
      parseInt(userID, 10),
      parseInt(rosterID, 10),
    );

    res.json(status);
  },
);

/* GET this user's signup status in the context of a roster. */
router.get('/signup-status/:rosterID', async (req: Request, res: Response) => {
  const { rosterID } = req.params;

  if (!req.user) {
    res.json({ error: 'User not found' });
    return;
  }

  const authenticatedUser = req.user as User;

  const status = await AnalysisController.GetSignupStatusForUser(
    authenticatedUser.id,
    parseInt(rosterID, 10),
  );

  res.json(status);
});

export default router;
