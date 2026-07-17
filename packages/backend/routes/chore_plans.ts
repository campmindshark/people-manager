import express, { Request, Response, Router } from 'express';
import ChorePlanController from '../controllers/chore_plan';
import ChorePlanReadinessController from '../controllers/chore_plan_readiness';
import hasPermission from '../middleware/rbac';
import User from '../models/user/user';
import ChorePlanError from '../utils/chorePlanError';
import { ChorePlanRequirements } from '../view_models/chore_plan';
import { validateRequirements } from '../utils/chorePlanRequirements';

const router: Router = express.Router();

function parseInput(req: Request): {
  rosterID: number;
  camperCount: number;
  sheetUrl: string;
  requirements: ChorePlanRequirements;
} {
  const rosterID = Number(req.body.rosterID);
  const camperCount = Number(req.body.camperCount);
  const sheetUrl = String(req.body.sheetUrl ?? '').trim();
  const requirements = validateRequirements(req.body.requirements);
  if (!Number.isInteger(rosterID) || rosterID < 1) {
    throw new Error('Choose a valid roster.');
  }
  if (!Number.isInteger(camperCount) || camperCount < 1 || camperCount > 200) {
    throw new Error('Camper count must be a whole number from 1 to 200.');
  }
  if (!sheetUrl) {
    throw new Error('Enter a Google Sheets link.');
  }
  return { rosterID, camperCount, sheetUrl, requirements };
}

function parseID(value: string, label: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new ChorePlanError(`Choose a valid ${label}.`, 400);
  }
  return id;
}

function sendChorePlanError(error: unknown, res: Response, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  res
    .status(error instanceof ChorePlanError ? error.status : 400)
    .json({ error: message });
}

router.get(
  '/:rosterID/audit-log',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    const rosterID = Number(req.params.rosterID);
    if (!Number.isInteger(rosterID) || rosterID < 1) {
      res.status(400).json({ error: 'Choose a valid roster.' });
      return;
    }
    res.json({ entries: await ChorePlanController.GetAuditLog(rosterID) });
  },
);

router.get(
  '/:rosterID',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    const rosterID = Number(req.params.rosterID);
    if (!Number.isInteger(rosterID) || rosterID < 1) {
      res.status(400).json({ error: 'Choose a valid roster.' });
      return;
    }
    res.json({ plan: await ChorePlanController.GetByRosterID(rosterID) });
  },
);

router.get(
  '/:rosterID/readiness',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const rosterID = Number(req.params.rosterID);
      if (!Number.isInteger(rosterID) || rosterID < 1) {
        throw new ChorePlanError('Choose a valid roster.', 400);
      }
      res.json(await ChorePlanReadinessController.GetByRosterID(rosterID));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not review chore-plan readiness.';
      res
        .status(error instanceof ChorePlanError ? error.status : 500)
        .json({ error: message });
    }
  },
);

router.post(
  '/preview',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const { rosterID, camperCount, sheetUrl, requirements } = parseInput(req);
      const preview = await ChorePlanController.Preview(
        rosterID,
        camperCount,
        sheetUrl,
        requirements,
      );
      res.json(preview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not preview the plan.';
      res.status(400).json({ error: message });
    }
  },
);

router.put(
  '/:rosterID/participants/:userID/requirements',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const rosterID = parseID(req.params.rosterID, 'roster');
      const userID = parseID(req.params.userID, 'participant');
      const requirements = validateRequirements(req.body.requirements);
      const reason = String(req.body.reason ?? '');
      const actor = req.user as User;
      res.json(
        await ChorePlanController.SetParticipantRequirements(
          rosterID,
          userID,
          requirements,
          reason,
          actor.id,
        ),
      );
    } catch (error) {
      sendChorePlanError(
        error,
        res,
        'Could not update participant requirements.',
      );
    }
  },
);

router.delete(
  '/:rosterID/participants/:userID/requirements',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const rosterID = parseID(req.params.rosterID, 'roster');
      const userID = parseID(req.params.userID, 'participant');
      const actor = req.user as User;
      res.json(
        await ChorePlanController.ResetParticipantRequirements(
          rosterID,
          userID,
          actor.id,
        ),
      );
    } catch (error) {
      sendChorePlanError(
        error,
        res,
        'Could not reset participant requirements.',
      );
    }
  },
);

router.post(
  '/:rosterID/open-signups',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const rosterID = Number(req.params.rosterID);
      if (!Number.isInteger(rosterID) || rosterID < 1) {
        throw new ChorePlanError('Choose a valid roster.', 400);
      }
      const user = req.user as User;
      res.json({
        plan: await ChorePlanController.OpenSignups(rosterID, user.id),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not open signups.';
      res
        .status(error instanceof ChorePlanError ? error.status : 400)
        .json({ error: message });
    }
  },
);

router.post(
  '/:rosterID/close-signups',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const rosterID = Number(req.params.rosterID);
      if (!Number.isInteger(rosterID) || rosterID < 1) {
        throw new ChorePlanError('Choose a valid roster.', 400);
      }
      const user = req.user as User;
      res.json({
        plan: await ChorePlanController.CloseSignups(rosterID, user.id),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not close signups.';
      res
        .status(error instanceof ChorePlanError ? error.status : 400)
        .json({ error: message });
    }
  },
);

router.post(
  '/generate',
  hasPermission('chorePlans:manage'),
  async (req: Request, res: Response) => {
    try {
      const { rosterID, camperCount, sheetUrl, requirements } = parseInput(req);
      const preview = await ChorePlanController.Preview(
        rosterID,
        camperCount,
        sheetUrl,
        requirements,
      );
      const user = req.user as User;
      res.json(await ChorePlanController.Apply(preview, user.id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate the plan.';
      res
        .status(error instanceof ChorePlanError ? error.status : 400)
        .json({ error: message });
    }
  },
);

export default router;
