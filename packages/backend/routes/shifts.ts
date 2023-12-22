import express, { Request, Response, NextFunction, Router } from 'express';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import ShiftController from '../controllers/shift';

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

/* GET Shifts by participantID. */
router.get(
  '/by_participantID/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const participantID = parseInt(req.params.id, 10);
    const shifts =
      await ShiftController.GetShiftViewModelsByParticipantID(participantID);
    res.json(shifts);
  },
);

/* GET Participant(s) of a specific shift. */
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
    const { id } = req.params;

    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const user = req.user as User;

    console.log(`Signing up user ${user.id} for shift ${id}`);

    const success = await ShiftController.RegisterParticipantForShift(
      parseInt(id, 10),
      user.id,
    );

    if (!success) {
      res.status(500).json({ error: 'Failed to register user for shift' });
      return;
    }
    res.json({ success: true });
  },
);

/* Unregister the current user from a specific shift. */
router.get(
  '/:id/unregister',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const user = req.user as User;

    console.log(`Unregister user ${user.id} from shift ${id}`);

    const success = await ShiftController.UnregisterParticipantFromShift(
      parseInt(id, 10),
      user.id,
    );

    if (!success) {
      res.status(500).json({ error: 'Failed to unregister user from shift' });
      return;
    }

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
