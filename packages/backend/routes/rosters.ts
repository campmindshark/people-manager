import express, { Request, Response, NextFunction, Router } from 'express';
import Roster from '../models/roster/roster';
import hasPermission from '../middleware/rbac';
import User from '../models/user/user';
import RosterController from '../controllers/roster';
import RosterParticipantViewModel from '../view_models/roster_participant';
import RosterParticipant from '../models/roster_participant/roster_participant';

const router: Router = express.Router();

/* GET Roster(s). */
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.query();

    const rosters = await query;
    res.json(rosters);
  },
);

/* GET Roster by ID. */
router.get(
  '/:id',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.query().findById(req.params.id);

    const roster = await query;
    res.json(roster);
  },
);

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

    console.log(
      `Signing up user ${user.id} - ${user.displayName()} for roster ${id}`,
    );

    const success = await RosterController.RegisterParticipantForRoster(
      parseInt(id, 10),
      user.id,
    );

    if (!success) {
      res.status(500).json({ error: 'Failed to register user for roster' });
      return;
    }
    res.json({ success: true });
  },
);

/* Get Participants. */
router.get(
  '/:id/participants',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.relatedQuery('participants').for(req.params.id);

    const users = await query;

    const viewModels: RosterParticipantViewModel[] = [];
    for (const user of users as User[]) {
      const participantQuery = RosterParticipant.query().where(
        'userID',
        user.id,
      );
      const participant = await participantQuery;
      console.log(participant);
      viewModels.push({
        user,
        rosterParticipant: participant[0],
      });
    }

    res.json(viewModels);
  },
);

router.post(
  '/',
  hasPermission('rosters:create'),
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
  hasPermission('rosters:delete'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const query = Roster.query().deleteById(id);

    const schedules = await query;
    res.json(schedules);
  },
);

export default router;
