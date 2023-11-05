import express, {Request, Response, NextFunction} from 'express';
import User from '../user/user';

var router = express.Router();

/* GET users listing. */
router.get('/', async function(req: Request, res: Response, next: NextFunction) {
	const query = User.query();

	const users = await query;
	res.json(users);
});

export default router;
