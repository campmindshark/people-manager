import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';

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

export default router;
