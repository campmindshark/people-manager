import express, { Request, Response, Router } from 'express';
import ChoreCatalogController from '../controllers/chore_catalog';
import ChorePlanAssignmentsController from '../controllers/chore_plan_assignments';
import ChorePlanDraftController from '../controllers/chore_plan_draft';
import ChorePlanFinalAssignmentsController from '../controllers/chore_plan_final_assignments';
import ChorePlanLifecycleController from '../controllers/chore_plan_lifecycle';
import ChorePlanPreviewController from '../controllers/chore_plan_preview';
import ChorePlanReadinessController from '../controllers/chore_plan_readiness';
import ChorePlanRequirementsController from '../controllers/chore_plan_requirements';
import ChorePlanShiftsController from '../controllers/chore_plan_shifts';
import ChorePlanSignupController from '../controllers/chore_plan_signup';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import User from '../models/user/user';
import ChoreCatalogError from '../utils/choreCatalogError';
import { parseChoreCatalogScoreUpdate } from '../utils/choreCatalogInput';
import ChorePlanAssignmentError from '../utils/chorePlanAssignmentError';
import {
  parseChorePlanAdminAssignmentMutation,
  parseChorePlanForceAssignmentRequest,
} from '../utils/chorePlanAssignmentInput';
import ChorePlanLifecycleError from '../utils/chorePlanLifecycleError';
import ChorePlanFinalAssignmentsError from '../utils/chorePlanFinalAssignmentsError';
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
import ChorePlanReadinessError from '../utils/chorePlanReadinessError';
import ChorePlanRequirementError from '../utils/chorePlanRequirementError';
import {
  parseChorePlanRequirementOverrideClearRequest,
  parseChorePlanRequirementOverrideRequest,
  parseChorePlanRequirementParticipantID,
} from '../utils/chorePlanRequirementInput';
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
const assignmentsController = new ChorePlanAssignmentsController();
const draftController = new ChorePlanDraftController();
const finalAssignmentsController = new ChorePlanFinalAssignmentsController();
const lifecycleController = new ChorePlanLifecycleController();
const previewController = new ChorePlanPreviewController();
const readinessController = new ChorePlanReadinessController();
const requirementsController = new ChorePlanRequirementsController();
const shiftsController = new ChorePlanShiftsController();
const signupController = new ChorePlanSignupController();

function sendError(error: unknown, res: Response, operation: string): void {
  if (
    (error instanceof ChoreCatalogError ||
      error instanceof ChorePlanAssignmentError ||
      error instanceof ChorePlanFinalAssignmentsError ||
      error instanceof ChorePlanLifecycleError ||
      error instanceof ChorePlanPreviewError ||
      error instanceof ChorePlanReadinessError ||
      error instanceof ChorePlanRequirementError ||
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
  '/admin/:rosterID/readiness',
  userIsVerified(),
  hasPermission('chorePlans:readiness'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await readinessController.getByRosterID(
          parseChorePlanRosterID(req.params.rosterID),
        ),
      );
    } catch (error) {
      sendError(error, res, 'load chore plan readiness');
    }
  },
);

router.get(
  '/admin/:rosterID/requirements',
  userIsVerified(),
  hasPermission('chorePlans:overrideRequirements'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await requirementsController.getView(
          parseChorePlanRosterID(req.params.rosterID),
        ),
      );
    } catch (error) {
      sendError(error, res, 'load participant chore requirements');
    }
  },
);

router.put(
  '/admin/:rosterID/participants/:userID/requirements',
  userIsVerified(),
  hasPermission('chorePlans:overrideRequirements'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await requirementsController.setOverride(
          parseChorePlanRosterID(req.params.rosterID),
          parseChorePlanRequirementParticipantID(req.params.userID),
          parseChorePlanRequirementOverrideRequest(req.body),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'update participant chore requirements');
    }
  },
);

router.delete(
  '/admin/:rosterID/participants/:userID/requirements',
  userIsVerified(),
  hasPermission('chorePlans:overrideRequirements'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const request = parseChorePlanRequirementOverrideClearRequest(req.body);
      res.json(
        await requirementsController.clearOverride(
          parseChorePlanRosterID(req.params.rosterID),
          parseChorePlanRequirementParticipantID(req.params.userID),
          request.reason,
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'clear participant chore requirements');
    }
  },
);

router.get(
  '/admin/:rosterID/assignments',
  userIsVerified(),
  hasPermission('chorePlans:assign'),
  async (req: Request, res: Response) => {
    try {
      res.json(
        await assignmentsController.getView(
          parseChorePlanRosterID(req.params.rosterID),
        ),
      );
    } catch (error) {
      sendError(error, res, 'load administrative chore assignments');
    }
  },
);

router.post(
  '/admin/:rosterID/assignments',
  userIsVerified(),
  hasPermission('chorePlans:assign'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await assignmentsController.mutate(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
          parseChorePlanAdminAssignmentMutation(req.body),
        ),
      );
    } catch (error) {
      sendError(error, res, 'change administrative chore assignments');
    }
  },
);

router.post(
  '/admin/:rosterID/force-assignments',
  userIsVerified(),
  hasPermission('chorePlans:assign'),
  hasPermission('chorePlans:forceAssign'),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const request = parseChorePlanForceAssignmentRequest(req.body);
      res.json(
        await assignmentsController.mutate(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
          request.mutation,
          request.reason,
        ),
      );
    } catch (error) {
      sendError(error, res, 'force administrative chore assignments');
    }
  },
);

router.get(
  '/:rosterID/final-assignments',
  userIsVerified(),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      res.json(
        await finalAssignmentsController.getForUser(
          parseChorePlanRosterID(req.params.rosterID),
          user.id,
        ),
      );
    } catch (error) {
      sendError(error, res, 'load final chore assignments');
    }
  },
);

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
