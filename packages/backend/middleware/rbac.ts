import { Request, Response, NextFunction } from 'express';
import RoleConfigCollection from '../roles/role';
import User from '../models/user/user';
import RoleController from '../controllers/role';

const hasPermission =
  (permission: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;

    try {
      const roles = await RoleController.getRolesByUserID(user.id);
      const roleIDs = roles.map((role) => role.id);

      if (RoleConfigCollection.hasPermission(roleIDs, permission)) {
        next();
      } else {
        res.status(403).send('Forbidden');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).send('Internal Server Error');
    }
  };

export default hasPermission;
