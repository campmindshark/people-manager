import express, { Request, Response, Router } from 'express';
import { DateTime } from 'luxon';
import { ValidationError } from 'objection';
import RosterParticipantController from '../controllers/roster_participant';
import User from '../models/user/user';
import Roster from '../models/roster/roster';
import RosterParticipant from '../models/roster_participant/roster_participant';
import hasPermission from '../middleware/rbac';
import { assertYearsAtCampWithinRoster } from '../utils/campYears';

const router: Router = express.Router();

/* GET all roster participants. */
router.get(
  '/',
  hasPermission('rosterParticipant:readAll'),
  async (req: Request, res: Response) => {
    const query = RosterParticipant.query();
    const rosterParticipants = await query;

    res.json(rosterParticipants);
  },
);

/* GET this users roster signup for a particular rosterID. */
router.get('/my-signup-by-roster/:id', async (req: Request, res: Response) => {
  const user = req.user as User;
  const rosterID = req.params.id;

  const query = RosterParticipant.query()
    .where({
      userID: user.id,
      rosterID,
    })
    .first();

  const rosterParticipant = await query;
  if (!rosterParticipant) {
    res.json({ error: 'User not found in roster' }).status(404);
    return;
  }

  res.json(rosterParticipant);
});

/* POST signup new roster participant. */
router.post('/:id', async (req: Request, res: Response) => {
  const user = req.user as User;
  const proposedRosterParticipant: RosterParticipant = req.body;

  const rosterID = parseInt(req.params.id, 10);
  if (Number.isNaN(rosterID)) {
    res.status(400).json({ error: 'Invalid roster ID' });
    return;
  }

  const roster = await Roster.query().findById(rosterID);
  if (!roster) {
    res.status(404).json({ error: 'Roster not found' });
    return;
  }

  const yearsValidation = assertYearsAtCampWithinRoster(
    proposedRosterParticipant.yearsAtCamp,
    roster.year,
  );
  if (!yearsValidation.valid) {
    res.status(400).json({ error: yearsValidation.error });
    return;
  }

  const signupScope = {
    userID: user.id,
    rosterID,
  };

  const checkCurrent = await RosterParticipant.query().where(signupScope);

  // Convert the dates to UTC while preserving the local time
  const parsedArrivalDate = DateTime.fromJSDate(
    new Date(proposedRosterParticipant.estimatedArrivalDate),
  )
    .setZone('America/Los_Angeles', { keepLocalTime: true })
    .toUTC()
    .toJSDate();

  const parsedDepartureDate = DateTime.fromJSDate(
    new Date(proposedRosterParticipant.estimatedDepartureDate),
  )
    .setZone('America/Los_Angeles', { keepLocalTime: true })
    .toUTC()
    .toJSDate();

  try {
    if (checkCurrent.length > 0) {
      delete req.body.id;
      await RosterParticipant.query()
        .where(signupScope)
        .patch({
          ...req.body,
          estimatedArrivalDate: parsedArrivalDate,
          estimatedDepartureDate: parsedDepartureDate,
        });

      const rosterParticipant = await RosterParticipant.query().findById(
        checkCurrent[0].id,
      );

      res.json(rosterParticipant);
      return;
    }

    const rosterParticipant = await RosterParticipant.query().insert({
      ...req.body,
      estimatedArrivalDate: parsedArrivalDate,
      estimatedDepartureDate: parsedDepartureDate,
      userID: user.id,
      rosterID,
    });

    res.json(rosterParticipant);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.data });
      return;
    }
    throw error;
  }
});

/* DELETE remove user from roster (admin only). */
router.delete(
  '/:rosterId/users/:userId',
  hasPermission('rosterParticipant:delete'),
  async (req: Request, res: Response) => {
    const { rosterId, userId } = req.params;

    if (!rosterId || !userId) {
      res.status(400).json({ error: 'Roster ID and User ID are required' });
      return;
    }

    const parsedRosterID = parseInt(rosterId, 10);
    const parsedUserID = parseInt(userId, 10);
    if (Number.isNaN(parsedRosterID) || Number.isNaN(parsedUserID)) {
      res.status(400).json({ error: 'Roster ID and User ID must be valid' });
      return;
    }

    const result = await RosterParticipantController.RemoveFromRoster(
      parsedRosterID,
      [parsedUserID],
    );

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'User not found in roster' });
      return;
    }

    res.json({ success: true, ...result });
  },
);

/* DELETE remove multiple users from roster (admin only). */
router.delete(
  '/:rosterId/users',
  hasPermission('rosterParticipant:delete'),
  async (req: Request, res: Response) => {
    const { rosterId } = req.params;
    const { userIds } = req.body;

    if (!rosterId || !userIds || !Array.isArray(userIds)) {
      res
        .status(400)
        .json({ error: 'Roster ID and user IDs array are required' });
      return;
    }

    const parsedRosterID = parseInt(rosterId, 10);
    const parsedUserIDs = userIds.map(Number);
    if (
      Number.isNaN(parsedRosterID) ||
      parsedUserIDs.some((userID) => !Number.isInteger(userID) || userID < 1)
    ) {
      res.status(400).json({ error: 'Roster ID and user IDs must be valid' });
      return;
    }

    const result = await RosterParticipantController.RemoveFromRoster(
      parsedRosterID,
      parsedUserIDs,
    );

    if (result.deletedCount === 0) {
      res
        .status(404)
        .json({ error: 'No participants found for the given user IDs' });
      return;
    }

    res.json({ success: true, ...result });
  },
);

export default router;
