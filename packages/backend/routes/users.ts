import express, { Request, Response, NextFunction } from "express";
import User from "../user/user";

const router = express.Router();

/* GET users listing. */
router.get(
  "/",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, next: NextFunction) => {
    const query = User.query();

    const users = await query;
    res.json(users);
  }
);

export default router;
