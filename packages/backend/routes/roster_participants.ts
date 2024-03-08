import express, { Request, Response, Router } from 'express';
import User from '../models/user/user';
import RosterParticipant from '../models/roster_participant/roster_participant';

const router: Router = express.Router();

/* GET all roster participants. */
router.get('/', async (req: Request, res: Response) => {
  const query = RosterParticipant.query();
  const rosterParticipants = await query;

  res.json(rosterParticipants);
});

/* POST signup new roster participant. */
router.post('/:id', async (req: Request, res: Response) => {
  const user = req.user as User;
  const proposedRosterParticipant: RosterParticipant = req.body;

  const checkCurrent = await RosterParticipant.query().where({
    userID: user.id,
    rosterID: req.params.id,
  });

  if (checkCurrent.length > 0) {
    res.status(400).json({ message: 'User already signed up for this roster' });
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
