import express, { Request, Response, Router } from 'express';
import User from '../models/user/user';
import RosterParticipant from '../models/roster_participant/roster_participant';
import hasPermission from '../middleware/rbac';
import { DateTime } from 'luxon';

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

  const signupScope = {
    userID: user.id,
    rosterID: req.params.id,
  };

  const checkCurrent = await RosterParticipant.query().where(signupScope);

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

  if (checkCurrent.length > 0) {
    delete req.body.id;
    await RosterParticipant.query()
      .where(signupScope)
      .patch({
        ...req.body,
        estimatedArrivalDate: parsedArrivalDate,
        estimatedDepartureDate: parsedDepartureDate,
        yearsAtCamp: JSON.stringify(proposedRosterParticipant.yearsAtCamp),
      });

    const rosterParticipant = await RosterParticipant.query().findById(
      checkCurrent[0].id,
    );

    res.json(rosterParticipant);
    return;
  }

  const rosterParticipant = await RosterParticipant.query().insert({
    ...req.body,
    yearsAtCamp: JSON.stringify(proposedRosterParticipant.yearsAtCamp),
    userID: user.id,
    rosterID: req.params.id,
  });

  res.json(rosterParticipant);
});

export default router;
