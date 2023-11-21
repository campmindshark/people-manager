import express, { Request, Response, NextFunction, Router } from 'express';
import Roster from '../models/roster/roster';

const router: Router = express.Router();

/* GET Schedule(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.query();

    const schedules = await query;
    res.json(schedules);
  },
);

/* Get Participants. */
router.get(
  '/:id/participants',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.relatedQuery('participants').for(req.params.id);

    const participants = await query;
    res.json(participants);
  },
);

router.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const newRoster: Roster = req.body;
    const query = Roster.query().insert(newRoster);

    const schedules = await query;
    res.json(schedules);
  },
);

router.delete(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Roster.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
