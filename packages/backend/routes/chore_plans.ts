import express, { Request, RequestHandler, Response, Router } from 'express';
import ChorePlanController from '../controllers/chore_plan';
import ChorePlanReadinessController from '../controllers/chore_plan_readiness';
import hasPermission from '../middleware/rbac';
import User from '../models/user/user';
import ChorePlanError from '../utils/chorePlanError';
import { ChorePlanRequirements } from '../view_models/chore_plan';
import { validateRequirements } from '../utils/chorePlanRequirements';

type ChorePlanRouteController = Pick<
  typeof ChorePlanController,
  | 'GetAuditLog'
  | 'GetByRosterID'
  | 'Preview'
  | 'Apply'
  | 'SetParticipantRequirements'
  | 'ResetParticipantRequirements'
  | 'OpenSignups'
  | 'CloseSignups'
>;

type ChorePlanReadinessRouteController = Pick<
  typeof ChorePlanReadinessController,
  'GetByRosterID'
>;

export interface ChorePlanRouteDependencies {
  chorePlanController?: Partial<ChorePlanRouteController>;
  chorePlanReadinessController?: Partial<ChorePlanReadinessRouteController>;
  permissionMiddleware?: (permission: string) => RequestHandler;
}

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
    throw new ChorePlanError('Choose a valid roster.', 400);
  }
  if (!Number.isInteger(camperCount) || camperCount < 1 || camperCount > 200) {
    throw new ChorePlanError(
      'Camper count must be a whole number from 1 to 200.',
      400,
    );
  }
  if (!sheetUrl) {
    throw new ChorePlanError('Enter a Google Sheets link.', 400);
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
  if (error instanceof ChorePlanError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export function createChorePlanRouter(
  dependencies: ChorePlanRouteDependencies = {},
): Router {
  const router: Router = express.Router();
  const chorePlanController: ChorePlanRouteController = {
    GetAuditLog: ChorePlanController.GetAuditLog,
    GetByRosterID: ChorePlanController.GetByRosterID,
    Preview: ChorePlanController.Preview,
    Apply: ChorePlanController.Apply,
    SetParticipantRequirements: ChorePlanController.SetParticipantRequirements,
    ResetParticipantRequirements:
      ChorePlanController.ResetParticipantRequirements,
    OpenSignups: ChorePlanController.OpenSignups,
    CloseSignups: ChorePlanController.CloseSignups,
    ...dependencies.chorePlanController,
  };
  const chorePlanReadinessController: ChorePlanReadinessRouteController = {
    GetByRosterID: ChorePlanReadinessController.GetByRosterID,
    ...dependencies.chorePlanReadinessController,
  };
  const permissionMiddleware =
    dependencies.permissionMiddleware ?? hasPermission;

  router.get(
    '/:rosterID/audit-log',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      const rosterID = Number(req.params.rosterID);
      if (!Number.isInteger(rosterID) || rosterID < 1) {
        res.status(400).json({ error: 'Choose a valid roster.' });
        return;
      }
      res.json({ entries: await chorePlanController.GetAuditLog(rosterID) });
    },
  );

  router.get(
    '/:rosterID',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      const rosterID = Number(req.params.rosterID);
      if (!Number.isInteger(rosterID) || rosterID < 1) {
        res.status(400).json({ error: 'Choose a valid roster.' });
        return;
      }
      res.json({ plan: await chorePlanController.GetByRosterID(rosterID) });
    },
  );

  router.get(
    '/:rosterID/readiness',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const rosterID = parseID(req.params.rosterID, 'roster');
        res.json(await chorePlanReadinessController.GetByRosterID(rosterID));
      } catch (error) {
        sendChorePlanError(
          error,
          res,
          'Could not review chore-plan readiness.',
        );
      }
    },
  );

  router.post(
    '/preview',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const { rosterID, camperCount, sheetUrl, requirements } =
          parseInput(req);
        const preview = await chorePlanController.Preview(
          rosterID,
          camperCount,
          sheetUrl,
          requirements,
        );
        res.json(preview);
      } catch (error) {
        sendChorePlanError(error, res, 'Could not preview the plan.');
      }
    },
  );

  router.put(
    '/:rosterID/participants/:userID/requirements',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const rosterID = parseID(req.params.rosterID, 'roster');
        const userID = parseID(req.params.userID, 'participant');
        const requirements = validateRequirements(req.body.requirements);
        const reason = String(req.body.reason ?? '');
        const actor = req.user as User;
        res.json(
          await chorePlanController.SetParticipantRequirements(
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
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const rosterID = parseID(req.params.rosterID, 'roster');
        const userID = parseID(req.params.userID, 'participant');
        const actor = req.user as User;
        res.json(
          await chorePlanController.ResetParticipantRequirements(
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
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const rosterID = parseID(req.params.rosterID, 'roster');
        const user = req.user as User;
        res.json({
          plan: await chorePlanController.OpenSignups(rosterID, user.id),
        });
      } catch (error) {
        sendChorePlanError(error, res, 'Could not open signups.');
      }
    },
  );

  router.post(
    '/:rosterID/close-signups',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const rosterID = parseID(req.params.rosterID, 'roster');
        const user = req.user as User;
        res.json({
          plan: await chorePlanController.CloseSignups(rosterID, user.id),
        });
      } catch (error) {
        sendChorePlanError(error, res, 'Could not close signups.');
      }
    },
  );

  router.post(
    '/generate',
    permissionMiddleware('chorePlans:manage'),
    async (req: Request, res: Response) => {
      try {
        const { rosterID, camperCount, sheetUrl, requirements } =
          parseInput(req);
        const preview = await chorePlanController.Preview(
          rosterID,
          camperCount,
          sheetUrl,
          requirements,
        );
        const user = req.user as User;
        res.json(await chorePlanController.Apply(preview, user.id));
      } catch (error) {
        sendChorePlanError(error, res, 'Could not generate the plan.');
      }
    },
  );

  return router;
}

export default createChorePlanRouter();
