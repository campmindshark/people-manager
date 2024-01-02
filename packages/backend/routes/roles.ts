import express, { Request, Response, NextFunction, Router } from 'express';
import User from '../models/user/user';
import RoleController from '../controllers/role';

const router: Router = express.Router();

/* GET all users. */
router.get(
  '/my_roles',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    const roles = await RoleController.getRolesByUserId(user.id);

    res.json(roles);
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
