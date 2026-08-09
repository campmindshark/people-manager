import express, { Request, Response, NextFunction, Router } from 'express';
import Roster from '../models/roster/roster';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import User from '../models/user/user';
import RosterParticipantViewModel from '../view_models/roster_participant';
import AnalysisController from '../controllers/analysis';
import RosterController from '../controllers/roster';
import RosterParticipantController from '../controllers/roster_participant';

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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const rosterID = Number(req.params.id);
  if (!Number.isSafeInteger(rosterID) || rosterID < 1) {
    res.status(400).json({ error: 'Roster ID must be valid' });
    return;
  }

  try {
    const roster = await Roster.query().findById(rosterID);
    if (!roster) {
      res.status(404).json({ error: 'Roster not found' });
      return;
    }

    res.json(roster);
  } catch (error) {
    next(error);
  }
});

/* POST drop-out this user from the specific roster. */
router.post('/:id/drop-out', async (req: Request, res: Response) => {
  const rosterID = Number(req.params.id);

  const tmpUser = req.user as User;
  const user = User.fromJson(tmpUser);

  if (!Number.isSafeInteger(rosterID) || rosterID < 1) {
    res.status(400).json({ error: 'Roster ID must be valid' });
    return;
  }

  const result = await RosterParticipantController.RemoveFromRoster(
    rosterID,
    [user.id],
    user.id,
  );

  if (result.deletedCount === 0) {
    res.json({ error: 'User not found in roster' });
    return;
  }
  console.log(
    `Dropping out user ${
      user.id
    } - ${user.displayName()} from roster ${rosterID}`,
  );
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
