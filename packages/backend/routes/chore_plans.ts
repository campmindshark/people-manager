import express, { Request, Response, Router } from 'express';
import ChoreCatalogController from '../controllers/chore_catalog';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanPreviewController from '../controllers/chore_plan_preview';
import ChorePlanShiftsController from '../controllers/chore_plan_shifts';
import ChorePlanSignupController from '../controllers/chore_plan_signup';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import User from '../models/user/user';
import ChoreCatalogError from '../utils/choreCatalogError';
import { parseChoreCatalogScoreUpdate } from '../utils/choreCatalogInput';
import ChorePlanLifecycleError from '../utils/chorePlanLifecycleError';
import {
  parseChorePlanReopenRequest,
  parseEmptyLifecycleRequest,
} from '../utils/chorePlanLifecycleInput';
import {
  parseChorePlanApplyRequest,
  parseChorePlanPreviewRequest,
  parseChorePlanRosterID,
} from '../utils/chorePlanPreviewInput';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import ChorePlanShiftViewError from '../utils/chorePlanShiftViewError';
import ChorePlanSignupError from '../utils/chorePlanSignupError';
import {
  parseEmptyChorePlanSignupRequest,
  parseChorePlanShiftID,
  parseChorePlanSignupRequest,
  parseChorePlanSwitchRequest,
} from '../utils/chorePlanSignupInput';

const router: Router = express.Router();
const controller = new ChoreCatalogController();
const draftController = new ChorePlanDraftController();
const lifecycleController = new ChorePlanLifecycleController();
const previewController = new ChorePlanPreviewController();
const shiftsController = new ChorePlanShiftsController();
const signupController = new ChorePlanSignupController();

function sendError(error: unknown, res: Response, operation: string): void {
  if (
    (error instanceof ChoreCatalogError ||
      error instanceof ChorePlanLifecycleError ||
      error instanceof ChorePlanPreviewError ||
      error instanceof ChorePlanShiftViewError ||
      error instanceof ChorePlanSignupError) &&
    error.status < 500
  ) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(`Failed to ${operation}:`, error);
  res.status(500).json({ error: `Failed to ${operation}.` });
}

router.get(
  '/:rosterID/shifts',
  userIsVerified(),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await shiftsController.getForUser(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'load chore plan shifts');
    }
  },
);

router.post(
  '/:rosterID/signup',
  userIsVerified(),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const input = parseChorePlanSignupRequest(req.body);
      res.json(
        await signupController.signup(
          parseChorePlanRosterID(req.params.rosterID),
          input.shiftID,
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'sign up for the chore plan shift');
    }
  },
);

router.delete(
  '/:rosterID/signup/:shiftID',
  userIsVerified(),
  async (req: Request, res: Response) => {
    try {
      parseEmptyChorePlanSignupRequest(req.body);
      const user = req.user as User;
      res.json(
        await signupController.remove(
          parseChorePlanRosterID(req.params.rosterID),
          parseChorePlanShiftID(req.params.shiftID),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'remove the chore plan signup');
    }
  },
);

router.post(
  '/:rosterID/switch',
  userIsVerified(),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const input = parseChorePlanSwitchRequest(req.body);
      res.json(
        await signupController.switch(
          parseChorePlanRosterID(req.params.rosterID),
          input.fromShiftID,
          input.toShiftID,
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'switch chore plan shifts');
    }
  },
);

router.post(
  '/preview',
  userIsVerified(),
  hasPermission('chorePlans:preview'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await previewController.preview(parseChorePlanPreviewRequest(req.body)),
      );
    } catch (error) {
      sendError(error, res, 'preview the chore plan');
    }
  },
);

router.get(
  '/draft/:rosterID',
  userIsVerified(),
  hasPermission('chorePlans:apply'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await draftController.getByRosterID(
          parseChorePlanRosterID(req.params.rosterID),
        ),
      );
    } catch (error) {
      sendError(error, res, 'load the chore plan draft');
    }
  },
);

router.post(
  '/apply',
  userIsVerified(),
  hasPermission('chorePlans:apply'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await draftController.apply(
          parseChorePlanApplyRequest(req.body),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'apply the chore plan draft');
    }
  },
);

router.get(
  '/:rosterID/lifecycle',
  userIsVerified(),
  hasPermission('chorePlans:lifecycle'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await lifecycleController.getByRosterID(
          parseChorePlanRosterID(req.params.rosterID),
        ),
      );
    } catch (error) {
      sendError(error, res, 'load the chore plan lifecycle');
    }
  },
);

router.post(
  '/:rosterID/open',
  userIsVerified(),
  hasPermission('chorePlans:lifecycle'),
  async (req: Request, res: Response) => {
    try {
      parseEmptyLifecycleRequest(req.body);
      const user = req.user as User;
      res.json(
        await lifecycleController.open(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'open the chore plan');
    }
  },
);

router.post(
  '/:rosterID/close',
  userIsVerified(),
  hasPermission('chorePlans:lifecycle'),
  async (req: Request, res: Response) => {
    try {
      parseEmptyLifecycleRequest(req.body);
      const user = req.user as User;
      res.json(
        await lifecycleController.close(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'close the chore plan');
    }
  },
);

router.post(
  '/:rosterID/reopen',
  userIsVerified(),
  hasPermission('chorePlans:reopen'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await lifecycleController.reopen(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
          parseChorePlanReopenRequest(req.body),
        ),
      );
    } catch (error) {
      sendError(error, res, 'reopen the chore plan');
    }
  },
);

router.get(
  '/catalog',
  userIsVerified(),
  hasPermission('choreCatalog:read'),
  async (_req: Request, res: Response) => {
    try {
      res.json(await controller.getCatalog());
    } catch (error) {
      sendError(error, res, 'load the chore catalog');
    }
  },
);

router.put(
  '/catalog/:definitionKey/score',
  userIsVerified(),
  hasPermission('choreCatalog:editScores'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const input = parseChoreCatalogScoreUpdate(req.body);
      res.json(
        await controller.updateScore(req.params.definitionKey, input, user.id),
      );
    } catch (error) {
      sendError(error, res, 'update the chore score');
    }
  },
);

export default router;
