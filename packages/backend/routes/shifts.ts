import express, { Request, Response, NextFunction, Router } from 'express';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import ShiftController, {
  ShiftParticipantAssignment,
} from '../controllers/shift';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import ShiftSignupError from '../utils/shiftSignupError';

const router: Router = express.Router();

function sendShiftAssignmentError(error: unknown, res: Response): void {
  if (error instanceof ShiftSignupError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Failed to update shift assignments:', error);
  res.status(500).json({ error: 'Failed to update shift assignments.' });
}

function parseParticipantAssignment(
  value: unknown,
): ShiftParticipantAssignment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { shiftID, userID } = value as {
    shiftID?: unknown;
    userID?: unknown;
  };
  if (
    !Number.isInteger(shiftID) ||
    Number(shiftID) < 1 ||
    !Number.isInteger(userID) ||
    Number(userID) < 1
  ) {
    return null;
  }
  return { shiftID: Number(shiftID), userID: Number(userID) };
}

function parseForce(value: unknown): boolean | null {
  if (value === undefined) {
    return false;
  }
  return typeof value === 'boolean' ? value : null;
}

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
    const newSchedule: Shift = req.body;
    const query = Shift.query().insert(newSchedule);

    const schedules = await query;
    res.json(schedules);
  },
);

/* Move one selected participant to another shift. */
router.post(
  '/reassign',
  hasPermission('shifts:swap'),
  async (req: Request, res: Response) => {
    const {
      source,
      destinationShiftID,
      force: requestedForce,
    } = req.body as {
      source?: unknown;
      destinationShiftID?: unknown;
      force?: unknown;
    };
    const parsedSource = parseParticipantAssignment(source);
    const force = parseForce(requestedForce);
    if (
      !parsedSource ||
      !Number.isInteger(destinationShiftID) ||
      Number(destinationShiftID) < 1 ||
      force === null
    ) {
      res.status(400).json({
        error:
          'source, destinationShiftID, and an optional boolean force flag are required.',
      });
      return;
    }

    try {
      const user = req.user as User;
      const result = await ShiftController.ReassignShiftParticipants(
        [
          {
            userID: parsedSource.userID,
            sourceShiftID: parsedSource.shiftID,
            destinationShiftID: Number(destinationShiftID),
          },
        ],
        user.id,
        force,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Remove one selected participant from a generated chore-plan shift. */
router.post(
  '/unassign',
  hasPermission('shifts:swap'),
  async (req: Request, res: Response) => {
    const { assignment } = req.body as { assignment?: unknown };
    const parsedAssignment = parseParticipantAssignment(assignment);
    if (!parsedAssignment) {
      res.status(400).json({
        error: 'assignment with valid shiftID and userID values is required.',
      });
      return;
    }

    try {
      const user = req.user as User;
      const result = await ShiftController.UnassignShiftParticipant(
        parsedAssignment,
        user.id,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Add one roster participant to an open generated chore-plan shift. */
router.post(
  '/assign',
  hasPermission('shifts:swap'),
  async (req: Request, res: Response) => {
    const { assignment } = req.body as { assignment?: unknown };
    const parsedAssignment = parseParticipantAssignment(assignment);
    if (!parsedAssignment) {
      res.status(400).json({
        error: 'assignment with valid shiftID and userID values is required.',
      });
      return;
    }

    try {
      const user = req.user as User;
      const result = await ShiftController.AssignShiftParticipant(
        parsedAssignment,
        user.id,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Swap two selected participants between their current shifts. */
router.post(
  '/swap',
  hasPermission('shifts:swap'),
  async (req: Request, res: Response) => {
    const { assignments, force: requestedForce } = req.body as {
      assignments?: unknown;
      force?: unknown;
    };
    const force = parseForce(requestedForce);
    if (!Array.isArray(assignments) || assignments.length !== 2) {
      res.status(400).json({ error: 'Select exactly two people to swap.' });
      return;
    }
    const parsedAssignments = assignments.map(parseParticipantAssignment);
    if (parsedAssignments.some((assignment) => !assignment) || force === null) {
      res.status(400).json({
        error:
          'Each assignment needs valid shiftID and userID values and force must be boolean.',
      });
      return;
    }

    try {
      const user = req.user as User;
      const [first, second] = parsedAssignments as [
        ShiftParticipantAssignment,
        ShiftParticipantAssignment,
      ];
      const result = await ShiftController.ReassignShiftParticipants(
        [
          {
            userID: first.userID,
            sourceShiftID: first.shiftID,
            destinationShiftID: second.shiftID,
          },
          {
            userID: second.userID,
            sourceShiftID: second.shiftID,
            destinationShiftID: first.shiftID,
          },
        ],
        user.id,
        force,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Atomically replace one chore-plan shift for the current user. */
router.post(
  '/change',
  userIsVerified(),
  async (req: Request, res: Response) => {
    const user = req.user as User;
    const { currentShiftID, replacementShiftID } = req.body as {
      currentShiftID?: unknown;
      replacementShiftID?: unknown;
    };

    try {
      const result = await ShiftController.ChangeParticipantChorePlanShift(
        Number(currentShiftID),
        Number(replacementShiftID),
        user.id,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Atomically add and remove chore-plan signups for the current user. */
router.patch(
  '/chore-signup',
  userIsVerified(),
  async (req: Request, res: Response) => {
    const user = req.user as User;
    const { addShiftIDs, removeShiftIDs } = req.body as {
      addShiftIDs?: unknown;
      removeShiftIDs?: unknown;
    };
    if (!Array.isArray(addShiftIDs) || !Array.isArray(removeShiftIDs)) {
      res.status(400).json({
        error: 'addShiftIDs and removeShiftIDs must be arrays.',
      });
      return;
    }

    try {
      const result = await ShiftController.EditParticipantChorePlanSignups(
        addShiftIDs.map(Number),
        removeShiftIDs.map(Number),
        user.id,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Confirm selected chore-plan shifts for the current user. */
router.post(
  '/signup',
  userIsVerified(),
  async (req: Request, res: Response) => {
    const user = req.user as User;
    const { shiftIDs } = req.body as { shiftIDs?: unknown };
    if (!Array.isArray(shiftIDs)) {
      res.status(400).json({ error: 'shiftIDs must be an array.' });
      return;
    }

    try {
      const result =
        await ShiftController.RegisterParticipantForChorePlanShifts(
          shiftIDs.map(Number),
          user.id,
        );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Sign up for a shift with the current user. */
router.post(
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
        parseInt(id, 10),
        user.id,
      );
      res.json(result);
    } catch (error) {
      sendShiftAssignmentError(error, res);
    }
  },
);

/* Unregister the current user from a legacy, non-chore-plan shift. */
router.delete(
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

    console.log(`Unregister user ${user.id} from shift ${id}`);

    try {
      await ShiftController.UnregisterParticipantFromShift(
        parseInt(id, 10),
        user.id,
      );
      res.json({ success: true });
    } catch (error) {
      sendShiftAssignmentError(error, res);
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
