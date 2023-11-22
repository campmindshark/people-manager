import express, { Request, Response, NextFunction, Router } from 'express';
import Schedule from '../models/schedule/schedule';

const router: Router = express.Router();

/* GET Schedule(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Schedule.query();

    const schedules = await query;
    res.json(schedules);
  },
);

/* GET Shift(s). */
router.get(
  '/:id/shifts',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    console.log(id);

    const query = Schedule.relatedQuery('shifts')
      .for(id)
      .orderBy('startTime', 'asc');

    const shifts = await query;
    res.json(shifts);
  },
);

router.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const newSchedule: Schedule = req.body;
    const query = Schedule.query().insert(newSchedule);

    const schedules = await query;
    res.json(schedules);
  },
);

router.delete(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Schedule.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
