import { Request, Response, NextFunction } from 'express';
import RoleConfigCollection from '../roles/role';
import User from '../models/user/user';
import RoleController from '../controllers/role';

const hasPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    const roles = await RoleController.getRolesByUserId(user.id);
    const roleIDs = roles.map((role) => role.id);

    if (RoleConfigCollection.hasPermission(roleIDs, permission)) {
      next();
    } else {
      res.status(403).send('Forbidden');
    }
  };
};

export default hasPermission;
