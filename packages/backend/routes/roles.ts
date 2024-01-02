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
    const roles = await RoleController.getRolesByUserID(user.id);

    res.json(roles);
  },
);

export default router;
