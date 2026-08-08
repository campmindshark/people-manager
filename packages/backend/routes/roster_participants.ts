import express, { Request, Response, Router } from 'express';
import { DateTime } from 'luxon';
import { ValidationError } from 'objection';
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

    const participant = await RosterParticipant.query()
      .where({
        userID: parseInt(userId, 10),
        rosterID: parseInt(rosterId, 10),
      })
      .first();

    if (!participant) {
      res.status(404).json({ error: 'User not found in roster' });
      return;
    }

    const success = await RosterParticipant.query().deleteById(participant.id);

    if (!success) {
      res.status(500).json({ error: 'Failed to remove user from roster' });
      return;
    }

    res.json({ success: true });
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

    const participants = await RosterParticipant.query()
      .where({
        rosterID: parseInt(rosterId, 10),
      })
      .whereIn('userID', userIds);

    if (participants.length === 0) {
      res
        .status(404)
        .json({ error: 'No participants found for the given user IDs' });
      return;
    }

    const participantIds = participants.map((p) => p.id);
    const deletedCount = await RosterParticipant.query()
      .whereIn('id', participantIds)
      .delete();

    res.json({ success: true, deletedCount });
  },
);

export default router;
