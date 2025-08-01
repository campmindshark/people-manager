import { Request, Response, NextFunction } from 'express';
import User from '../models/user/user';
import UserController from '../controllers/user';

const userIsVerified =
  () => async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;

    try {
      const isVerified = await UserController.isVerified(user);
      
      if (!isVerified) {
        res.status(403).send('Forbidden');
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking verification:', error);
      res.status(500).send('Internal Server Error');
    }
  };

export default userIsVerified;
