import express, { Request, Response, Router } from 'express';
import ChoreCatalogController from '../controllers/chore_catalog';
import hasPermission from '../middleware/rbac';
import userIsVerified from '../middleware/verified_user';
import User from '../models/user/user';
import ChoreCatalogError from '../utils/choreCatalogError';
import { parseChoreCatalogScoreUpdate } from '../utils/choreCatalogInput';

const router: Router = express.Router();
const controller = new ChoreCatalogController();

function sendError(error: unknown, res: Response, operation: string): void {
  if (error instanceof ChoreCatalogError && error.status < 500) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(`Failed to ${operation}:`, error);
  res.status(500).json({ error: `Failed to ${operation}.` });
}

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
