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

  const signupScope = {
    userID: user.id,
    rosterID: req.params.id,
  };

  const checkCurrent = await RosterParticipant.query().where(signupScope);

  if (checkCurrent.length > 0) {
    delete req.body.id;
    await RosterParticipant.query()
      .where(signupScope)
      .patch({
        ...req.body,
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
