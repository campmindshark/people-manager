import express, { Request, Response, NextFunction } from 'express';
import path from 'path';

var router = express.Router();

/* GET home page. */
router.get('/*', function (req: Request, res: Response, next: NextFunction) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export default router;
