import express, { Request, Response, NextFunction, Router } from 'express';
import Schedule from '../models/schedule/schedule';
import ShiftController from '../controllers/shift';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import hasChorePlanOwnershipColumns from '../utils/chorePlanSchema';

const router: Router = express.Router();

/* GET Schedule(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Schedule.query();
    if (await hasChorePlanOwnershipColumns(Schedule.knex())) {
      query.whereNull('chorePlanID');
    }

    const schedules = await query;
    res.json(schedules);
  },
);

/* GET Shift(s). */
router.get(
  '/:id/shifts',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response) => {
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
    if (
      req.body &&
      typeof req.body === 'object' &&
      ('chorePlanID' in req.body || 'plannerKey' in req.body)
    ) {
      res.status(400).json({ error: 'Generated schedules cannot be created.' });
      return;
    }
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
    if (await hasChorePlanOwnershipColumns(Schedule.knex())) {
      const generatedSchedule = await Schedule.knex()('schedules')
        .select('id')
        .where({ id })
        .whereNotNull('chorePlanID')
        .first();
      if (generatedSchedule) {
        res.sendStatus(404);
        return;
      }
    }
    const query = Schedule.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
