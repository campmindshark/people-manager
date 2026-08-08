import express, { Request, Response, NextFunction, Router } from 'express';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import ShiftController from '../controllers/shift';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import ShiftSignupError, { parseShiftID } from '../utils/shiftSignupError';
import parseEventDateTime from '../utils/eventTime';
import { PUBLIC_SHIFT_COLUMNS } from '../utils/scheduleApiColumns';

const router: Router = express.Router();

function sendShiftSignupError(error: unknown, res: Response): void {
  if (error instanceof ShiftSignupError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error('Failed to update shift signup:', error);
  res.status(500).json({ error: 'Failed to update shift signup.' });
}

/* GET Shift(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Shift.query().select(...PUBLIC_SHIFT_COLUMNS);

    const shifts = await query;
    res.json(shifts);
  },
);

/* GET Shifts by participantID. */
router.get(
  '/by_participantID/:id',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const participantID = parseInt(req.params.id, 10);
    const shifts =
      await ShiftController.GetShiftViewModelsByParticipantID(participantID);
    res.json(shifts);
  },
);

/* GET My Shifts. */
router.get(
  '/my-shifts',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedUser = req.user as User;

    const shifts = await ShiftController.GetShiftViewModelsByParticipantID(
      authenticatedUser.id,
    );
    res.json(shifts);
  },
);

/* GET Participant(s) of a specific shift. */
router.get(
  '/:id/participants',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Shift.relatedQuery('participants').for(req.params.id);

    const participants = await query;
    res.json(participants);
  },
);

router.post(
  '/',
  hasPermission('shifts:create'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    let startTime: Date;
    let endTime: Date;
    try {
      startTime = parseEventDateTime(req.body.startTime, 'Shift start time');
      endTime = parseEventDateTime(req.body.endTime, 'Shift end time');
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid shift time.',
      });
      return;
    }
    if (startTime >= endTime) {
      res.status(400).json({ error: 'Shift end time must follow start time.' });
      return;
    }
    const newShift: Shift = { ...req.body, startTime, endTime };
    const query = Shift.query().insert(newShift);

    const shift = await query;
    res.json(shift);
  },
);

/* Sign up for a shift with the current user. */
router.get(
  '/:id/signup',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const user = req.user as User;

    console.log(`Signing up user ${user.id} for shift ${id}`);

    try {
      const result = await ShiftController.RegisterParticipantForShift(
        parseShiftID(id),
        user.id,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      sendShiftSignupError(error, res);
    }
  },
);

/* Unregister the current user from a specific shift. */
router.get(
  '/:id/unregister',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!req.user) {
      res.json({ error: 'User not found' });
      return;
    }

    const user = req.user as User;

    console.log(`Unregister user ${user.id} from shift ${id}`);

    try {
      await ShiftController.UnregisterParticipantFromShift(
        parseShiftID(id),
        user.id,
      );
      res.json({ success: true });
    } catch (error) {
      sendShiftSignupError(error, res);
    }
  },
);

router.delete(
  '/:id',
  hasPermission('shifts:delete'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Shift.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
