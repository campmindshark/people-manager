import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';
import UserController from '../controllers/user';
import PrivateProfile from '../models/user/user_private';
import AnalysisController from '../controllers/analysis';
import hasPermission from '../middleware/rbac';

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

/* GET the users signup status in the context of a roster by ID. */
router.get(
  '/:userID/signup-status/:rosterID',
  async (req: Request, res: Response) => {
    const [rosterID, userID] = [req.params.rosterID, req.params.userID];

    const status = await AnalysisController.GetSignupStatusForUser(
      parseInt(userID, 10),
      parseInt(rosterID, 10),
    );

    res.json(status);
  },
);

export default router;
