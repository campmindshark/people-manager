import express, { Request, Response, Router } from 'express';
import User from '../models/user/user';
import RoleController from '../controllers/role';

const router: Router = express.Router();

/* GET all users. */
router.get('/my_roles', async (req: Request, res: Response) => {
  const user = req.user as User;
  const roles = await RoleController.getRolesByUserID(user.id);

  res.json(roles);
});

export default router;
