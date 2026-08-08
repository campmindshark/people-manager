import express, { Request, Response, Router } from 'express';
import { ValidationError } from 'objection';
import RosterParticipantController from '../controllers/roster_participant';
import User from '../models/user/user';
import Roster from '../models/roster/roster';
import RosterParticipant from '../models/roster_participant/roster_participant';
import hasPermission from '../middleware/rbac';
import { assertYearsAtCampWithinRoster } from '../utils/campYears';
import parseEventDateTime from '../utils/eventTime';
import { parseRosterParticipantBulkRemovalInput } from '../utils/rosterParticipantInput';

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

  let parsedArrivalDate: Date;
  let parsedDepartureDate: Date;
  try {
    parsedArrivalDate = parseEventDateTime(
      proposedRosterParticipant.estimatedArrivalDate,
      'Estimated arrival date',
    );
    parsedDepartureDate = parseEventDateTime(
      proposedRosterParticipant.estimatedDepartureDate,
      'Estimated departure date',
    );
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : 'Invalid roster attendance time.',
    });
    return;
  }

  if (
    !Number.isFinite(parsedArrivalDate.getTime()) ||
    !Number.isFinite(parsedDepartureDate.getTime()) ||
    parsedArrivalDate >= parsedDepartureDate
  ) {
    res.status(400).json({
      error: 'Arrival and departure dates must define a valid time window.',
    });
    return;
  }

  try {
    const {
      id: _id,
      userID: _userId,
      rosterID: _rosterId,
      ...participantFields
    } = req.body;
    const { rosterParticipant, removedAssignmentCount } =
      await RosterParticipant.knex().transaction(async (transaction) => {
        await transaction('users')
          .select('id')
          .where('id', user.id)
          .forUpdate()
          .first();
        const currentParticipants = await RosterParticipant.query(transaction)
          .where(signupScope)
          .orderBy('id')
          .forUpdate();
        const participantData = {
          ...participantFields,
          estimatedArrivalDate: parsedArrivalDate,
          estimatedDepartureDate: parsedDepartureDate,
        };
        let savedParticipant: RosterParticipant;
        if (currentParticipants.length > 0) {
          await RosterParticipant.query(transaction)
            .where(signupScope)
            .patch(participantData);
          const updatedParticipant = await RosterParticipant.query(
            transaction,
          ).findById(currentParticipants[0].id);
          if (!updatedParticipant) {
            throw new Error('Updated roster participant could not be loaded.');
          }
          savedParticipant = updatedParticipant;
        } else {
          savedParticipant = await RosterParticipant.query(transaction).insert({
            ...participantData,
            userID: user.id,
            rosterID,
          });
        }

        const removedCount =
          await RosterParticipantController.ReconcileAttendanceWindow(
            transaction,
            rosterID,
            user.id,
            {
              startTime: parsedArrivalDate,
              endTime: parsedDepartureDate,
            },
          );

        return {
          rosterParticipant: savedParticipant,
          removedAssignmentCount: removedCount,
        };
      });

    res.json({ ...rosterParticipant, removedAssignmentCount });
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
    const actor = req.user as User;

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
      actor.id,
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
    const actor = req.user as User;

    const removal = parseRosterParticipantBulkRemovalInput(rosterId, userIds);
    if (!removal) {
      res.status(400).json({ error: 'Valid roster and user IDs are required' });
      return;
    }

    const result = await RosterParticipantController.RemoveFromRoster(
      removal.rosterID,
      removal.userIDs,
      actor.id,
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
