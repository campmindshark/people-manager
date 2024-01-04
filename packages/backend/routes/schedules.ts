import express, { Request, Response, NextFunction, Router } from 'express';
import Schedule from '../models/schedule/schedule';
import ShiftController from '../controllers/shift';
import hasPermission from '../middleware/rbac';

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
    const shifts = await ShiftController.GetShiftViewModelsByScheduleID(
      parseInt(id, 10),
    );
    res.json(shifts);
  },
);

router.post(
  '/',
  hasPermission('schedules:create'),
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
  hasPermission('schedules:delete'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Schedule.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
