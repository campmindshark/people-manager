import express, { Request, Response, NextFunction, Router } from 'express';
import path from 'path';

const router: Router = express.Router();

/* GET home page. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.get('/*', (req: Request, res: Response, next: NextFunction) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

router.get('/health', (req: Request, res: Response) => {
  res.status(200).send('healthy');
});

export default router;
