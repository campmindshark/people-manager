import express, { Request, Response, NextFunction, Router } from 'express';
import Roster from '../models/roster/roster';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import User from '../models/user/user';
import RosterParticipantViewModel from '../view_models/roster_participant';
import RosterParticipant from '../models/roster_participant/roster_participant';
import AnalysisController from '../controllers/analysis';
import RosterController from '../controllers/roster';

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

/* POST drop-out this user from the specific roster. */
router.post('/:id/drop-out', async (req: Request, res: Response) => {
  const rosterID = req.params.id;

  const tmpUser = req.user as User;
  const user = User.fromJson(tmpUser);

  if (!rosterID) {
    res.json({ error: 'Roster ID not defined' });
    return;
  }

  const participant = await RosterParticipant.query()
    .where({
      userID: user.id,
      rosterID,
    })
    .first();

  if (!participant) {
    res.json({ error: 'User not found in roster' });
    return;
  }

  console.log(
    `Dropping out user ${
      user.id
    } - ${user.displayName()} from roster ${rosterID}`,
  );

  const success = await RosterParticipant.query().deleteById(participant.id);

  if (!success) {
    res.status(500).json({ error: 'Failed to drop out user from roster' });
    return;
  }
  res.json({ success: true });
});

/* Get Participants. */
router.get(
  '/:id/participants',
  userIsVerified(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.relatedQuery('participants').for(req.params.id);
    const users = await query;

    const promises: Promise<RosterParticipantViewModel>[] = [];
    for (let index = 0; index < users.length; index += 1) {
      const user = User.fromJson(users[index]);
      promises.push(
        RosterController.GetRosterParticipantViewModel(
          user,
          parseInt(req.params.id, 10),
        ),
      );
    }

    const viewModels = await Promise.all(promises);
    res.json(viewModels);
  },
);

router.get(
  '/:id/participants-detailed',
  userIsVerified(),
  hasPermission('rosters:read-detailed'),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = Roster.relatedQuery('participants').for(req.params.id);

    const users = await query;

    const promises: Promise<RosterParticipantViewModel>[] = [];
    for (let index = 0; index < users.length; index += 1) {
      const user = User.fromJson(users[index]);
      promises.push(
        RosterController.GetRosterParticipantsViewModelWithPrivateFields(user),
      );
    }

    const viewModels = await Promise.all(promises);
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

router.get(
  '/:id/participant-signup-statuses',
  hasPermission('signupStatus:readAll'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const allStatuses =
      await AnalysisController.GetSignupStatusForAllUsersInContextOfRoster(
        parseInt(id, 10),
      );

    res.json(allStatuses);
  },
);

export default router;
