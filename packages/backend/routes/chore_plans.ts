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
import { logChorePlanOperationalEvent } from '../utils/chorePlanOperationalEvent';
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

type ChorePlanClientError = Error & { status: number };
type SignupOperation = 'signup' | 'remove' | 'switch';

function isChorePlanClientError(error: unknown): error is ChorePlanClientError {
  return (
    error instanceof ChoreCatalogError ||
    error instanceof ChorePlanAssignmentError ||
    error instanceof ChorePlanFinalAssignmentsError ||
    error instanceof ChorePlanLifecycleError ||
    error instanceof ChorePlanPreviewError ||
    error instanceof ChorePlanReadinessError ||
    error instanceof ChorePlanRequirementError ||
    error instanceof ChorePlanShiftViewError ||
    error instanceof ChorePlanSignupError
  );
}

function operationalID(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function actorUserID(req: Request): number | null {
  return req.user ? (req.user as User).id : null;
}

function errorStatus(error: unknown): number {
  return isChorePlanClientError(error) ? error.status : 500;
}

function signupRejectionReason(error: unknown): string {
  if (error instanceof ChorePlanSignupError) {
    return error.reason;
  }
  const status = errorStatus(error);
  if (status === 400) {
    return 'invalid_request';
  }
  if (status === 403) {
    return 'not_authorized';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 409) {
    return 'conflict';
  }
  return 'internal_error';
}

function logSignupRejection(
  req: Request,
  error: unknown,
  operation: SignupOperation,
  shiftIDs: number[],
): void {
  const reason = signupRejectionReason(error);
  const fields = {
    actorUserID: actorUserID(req),
    rosterID: operationalID(req.params.rosterID),
    operation,
    shiftIDs,
    status: errorStatus(error),
    reason,
  };
  logChorePlanOperationalEvent('chore_plan.signup_rejected', fields, 'warning');
  if (reason === 'capacity') {
    logChorePlanOperationalEvent(
      'chore_plan.capacity_conflict',
      { ...fields, source: 'self_service' },
      'warning',
    );
  }
}

function logAdminCapacityConflict(
  req: Request,
  error: unknown,
  operation: string | null,
): void {
  if (!(error instanceof ChorePlanAssignmentError)) {
    return;
  }
  const conflictRule = error.conflictRules?.find((rule) =>
    rule.startsWith('capacity:'),
  );
  if (!conflictRule) {
    return;
  }
  logChorePlanOperationalEvent(
    'chore_plan.capacity_conflict',
    {
      actorUserID: actorUserID(req),
      rosterID: operationalID(req.params.rosterID),
      operation,
      status: error.status,
      source: 'admin_assignment',
      conflictRule,
    },
    'warning',
  );
}

function sendError(error: unknown, res: Response, operation: string): void {
  if (isChorePlanClientError(error) && error.status < 500) {
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
    let mutationOperation: string | null = null;
    try {
      const user = req.user as User;
      const rosterID = parseChorePlanRosterID(req.params.rosterID);
      const mutation = parseChorePlanAdminAssignmentMutation(req.body);
      mutationOperation = mutation.operation;
      res.json(await assignmentsController.mutate(rosterID, user.id, mutation));
    } catch (error) {
      logAdminCapacityConflict(req, error, mutationOperation);
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
      const rosterID = parseChorePlanRosterID(req.params.rosterID);
      const request = parseChorePlanForceAssignmentRequest(req.body);
      const result = await assignmentsController.mutate(
        rosterID,
        user.id,
        request.mutation,
        request.reason,
      );
      logChorePlanOperationalEvent('chore_plan.admin_force_completed', {
        actorUserID: user.id,
        rosterID,
        operation: request.mutation.operation,
        changed: result.changed,
        bypassedRules: result.bypassedRules,
      });
      res.json(result);
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
    const shiftIDs: number[] = [];
    try {
      const user = req.user as User;
      const input = parseChorePlanSignupRequest(req.body);
      shiftIDs.push(input.shiftID);
      res.json(
        await signupController.signup(
          parseChorePlanRosterID(req.params.rosterID),
          input.shiftIDs,
          user.id,
        ),
      );
    } catch (error) {
      logSignupRejection(req, error, 'signup', shiftIDs);
      sendError(error, res, 'sign up for the chore plan shift');
    }
  },
);

router.delete(
  '/:rosterID/signup/:shiftID',
  userIsVerified(),
  async (req: Request, res: Response) => {
    const shiftIDs: number[] = [];
    try {
      parseEmptyChorePlanSignupRequest(req.body);
      const user = req.user as User;
      const shiftID = parseChorePlanShiftID(req.params.shiftID);
      shiftIDs.push(shiftID);
      res.json(
        await signupController.remove(
          parseChorePlanRosterID(req.params.rosterID),
          shiftID,
          user.id,
        ),
      );
    } catch (error) {
      logSignupRejection(req, error, 'remove', shiftIDs);
      sendError(error, res, 'remove the chore plan signup');
    }
  },
);

router.post(
  '/:rosterID/switch',
  userIsVerified(),
  async (req: Request, res: Response) => {
    const shiftIDs: number[] = [];
    try {
      const user = req.user as User;
      const input = parseChorePlanSwitchRequest(req.body);
      shiftIDs.push(input.fromShiftID, input.toShiftID);
      res.json(
        await signupController.switch(
          parseChorePlanRosterID(req.params.rosterID),
          input.fromShiftID,
          input.toShiftID,
          user.id,
        ),
      );
    } catch (error) {
      logSignupRejection(req, error, 'switch', shiftIDs);
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
      const user = req.user as User;
      const input = parseChorePlanPreviewRequest(req.body);
      const result = await previewController.preview(input);
      logChorePlanOperationalEvent('chore_plan.preview_generated', {
        actorUserID: user.id,
        rosterID: result.rosterID,
        camperCount: result.camperCount,
        requirements: result.requirements,
        catalogRevision: result.catalogRevision,
        shiftCount: result.shifts.length,
        shortageCount: Object.values(result.categories).reduce(
          (total, category) => total + category.shortage,
          0,
        ),
      });
      res.json(result);
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
      const result = await draftController.apply(
        parseChorePlanApplyRequest(req.body),
        user.id,
      );
      logChorePlanOperationalEvent('chore_plan.draft_applied', {
        actorUserID: user.id,
        planID: result.draft.id,
        rosterID: result.draft.rosterID,
        changed: result.changed,
        replaced: result.replaced,
        draftRevision: result.draft.draftRevision,
        catalogRevision: result.draft.catalogRevision,
        scheduleCount: result.draft.scheduleCount,
        shiftCount: result.draft.shiftCount,
        slotCount: result.draft.slotCount,
      });
      res.json(result);
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
      const result = await lifecycleController.open(
        parseChorePlanRosterID(req.params.rosterID),
        user.id,
      );
      logChorePlanOperationalEvent('chore_plan.lifecycle_changed', {
        actorUserID: user.id,
        planID: result.id,
        rosterID: result.rosterID,
        action: 'open',
        fromStatus: 'draft',
        toStatus: result.status,
      });
      res.json(result);
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
      const result = await lifecycleController.close(
        parseChorePlanRosterID(req.params.rosterID),
        user.id,
      );
      logChorePlanOperationalEvent('chore_plan.lifecycle_changed', {
        actorUserID: user.id,
        planID: result.id,
        rosterID: result.rosterID,
        action: 'close',
        fromStatus: 'open',
        toStatus: result.status,
      });
      res.json(result);
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
      const result = await lifecycleController.reopen(
        parseChorePlanRosterID(req.params.rosterID),
        user.id,
        parseChorePlanReopenRequest(req.body),
      );
      logChorePlanOperationalEvent('chore_plan.lifecycle_changed', {
        actorUserID: user.id,
        planID: result.id,
        rosterID: result.rosterID,
        action: 'reopen',
        fromStatus: 'closed',
        toStatus: result.status,
      });
      res.json(result);
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
