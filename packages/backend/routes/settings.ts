import express, { Request, Response, Router } from 'express';
import AppSetting from '../models/app_setting/app_setting';
import Roster from '../models/roster/roster';
import hasPermission from '../middleware/rbac';

const router: Router = express.Router();

router.get('/active-roster', async (_req: Request, res: Response) => {
  try {
    const setting = await AppSetting.query()
      .where({ key: 'active_roster_id' })
      .first();

    if (!setting) {
      return res.status(404).json({ error: 'Active roster setting not found' });
    }

    return res.json({ activeRosterID: parseInt(setting.value, 10) });
  } catch (error) {
    console.error('Error fetching active roster setting:', error);
    return res
      .status(500)
      .json({ error: 'Failed to fetch active roster setting' });
  }
});

router.put(
  '/active-roster',
  hasPermission('settings:edit'),
  async (req: Request, res: Response) => {
    try {
      const { activeRosterID } = req.body;

      if (!activeRosterID || Number.isNaN(parseInt(activeRosterID, 10))) {
        return res
          .status(400)
          .json({ error: 'Valid activeRosterID is required' });
      }

      const rosterID = parseInt(activeRosterID, 10);

      const roster = await Roster.query().findById(rosterID);
      if (!roster) {
        return res
          .status(404)
          .json({ error: `Roster with ID ${rosterID} does not exist` });
      }

      const updated = await AppSetting.query()
        .where({ key: 'active_roster_id' })
        .patch({ value: String(rosterID) })
        .returning('*');

      if (!updated) {
        return res
          .status(404)
          .json({ error: 'Active roster setting not found' });
      }

      return res.json({ activeRosterID: rosterID });
    } catch (error) {
      console.error('Error updating active roster setting:', error);
      return res
        .status(500)
        .json({ error: 'Failed to update active roster setting' });
    }
  },
);

export default router;
