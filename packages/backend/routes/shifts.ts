import express, { Request, Response, NextFunction, Router } from 'express';
import Knex from 'knex';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';

const knex = Knex(knexConfig[getConfig().Environment]);

const router: Router = express.Router();

/* GET Shift(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Shift.query();

    const shifts = await query;
    res.json(shifts);
  },
);

router.get(
  '/by_userID/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    // const query = Shift.query().where('userID', req.params.id);

    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', req.params.id)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id');

    const shifts = await query;
    res.json(shifts);
  },
);

/* GET Participant(s). */
router.get(
  '/:id/participants',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Shift.relatedQuery('participants').for(req.params.id);

    const participants = await query;
    res.json(participants);
  },
);

router.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const newSchedule: Shift = req.body;
    const query = Shift.query().insert(newSchedule);

    const schedules = await query;
    res.json(schedules);
  },
);

/* Sign up for a shift with the current user. */
router.get(
  '/:id/signup',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = res.locals.user;
    const { id } = req.params;

    const appUser = await User.query().where('googleID', user.id).first();
    if (!appUser) {
      res.json({ error: 'User not found' });
      return;
    }

    await Shift.relatedQuery('participants').for(id).relate(appUser.id);
    res.json({ success: true });
  },
);

router.delete(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Shift.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
