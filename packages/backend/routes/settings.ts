import express, { Request, Response, Router } from 'express';
import AppSetting from '../models/app_setting/app_setting';
import Roster from '../models/roster/roster';
import hasPermission from '../middleware/rbac';

const router: Router = express.Router();
const ActiveRosterSettingKey = 'active_roster_id';
const EssentialMindSharkURLSettingKey = 'essential_mindshark_url';
const DefaultEssentialMindSharkURL = 'https://rb.gy/zmxncc';

interface FrontendLinksResponse {
  essentialMindSharkURL: string;
}

async function ensureActiveRosterSetting(): Promise<AppSetting | undefined> {
  await AppSetting.query()
    .insert({ key: ActiveRosterSettingKey, value: '2' })
    .onConflict('key')
    .ignore();

  const setting = await AppSetting.query()
    .where({ key: ActiveRosterSettingKey })
    .first();

  return setting;
}

async function ensureFrontendLinkSetting(
  key: string,
  defaultValue: string,
): Promise<AppSetting | undefined> {
  await AppSetting.query()
    .insert({ key, value: defaultValue })
    .onConflict('key')
    .ignore();

  return AppSetting.query().where({ key }).first();
}

router.get('/active-roster', async (_req: Request, res: Response) => {
  try {
    const setting = await ensureActiveRosterSetting();

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
      const parsedActiveRosterID = parseInt(activeRosterID, 10);

      if (Number.isNaN(parsedActiveRosterID)) {
        return res
          .status(400)
          .json({ error: 'Valid activeRosterID is required' });
      }

      const rosterID = parsedActiveRosterID;

      const roster = await Roster.query().findById(rosterID);
      if (!roster) {
        return res
          .status(404)
          .json({ error: `Roster with ID ${rosterID} does not exist` });
      }

      await AppSetting.query()
        .insert({ key: ActiveRosterSettingKey, value: String(rosterID) })
        .onConflict('key')
        .merge({ value: String(rosterID) });

      return res.json({ activeRosterID: rosterID });
    } catch (error) {
      console.error('Error updating active roster setting:', error);
      return res
        .status(500)
        .json({ error: 'Failed to update active roster setting' });
    }
  },
);

router.get('/frontend-links', async (_req: Request, res: Response) => {
  try {
    const essentialMindSharkURLSetting = await ensureFrontendLinkSetting(
      EssentialMindSharkURLSettingKey,
      DefaultEssentialMindSharkURL,
    );

    if (!essentialMindSharkURLSetting) {
      return res
        .status(404)
        .json({ error: 'Frontend link settings not found' });
    }

    const response: FrontendLinksResponse = {
      essentialMindSharkURL: essentialMindSharkURLSetting.value,
    };

    return res.json(response);
  } catch (error) {
    console.error('Error fetching frontend link settings:', error);
    return res.status(500).json({ error: 'Failed to fetch frontend links' });
  }
});

router.put(
  '/frontend-links',
  hasPermission('settings:edit'),
  async (req: Request, res: Response) => {
    try {
      const { essentialMindSharkURL } = req.body as FrontendLinksResponse;
      const normalizedEssentialMindSharkURL = essentialMindSharkURL?.trim();

      if (!normalizedEssentialMindSharkURL) {
        return res.status(400).json({
          error: 'A valid essentialMindSharkURL is required',
        });
      }

      try {
        const parsedURL = new URL(normalizedEssentialMindSharkURL);
        if (!['http:', 'https:'].includes(parsedURL.protocol)) {
          throw new Error('Unsupported URL protocol');
        }
      } catch {
        return res.status(400).json({
          error: 'A valid essentialMindSharkURL is required',
        });
      }

      await AppSetting.query()
        .insert({
          key: EssentialMindSharkURLSettingKey,
          value: normalizedEssentialMindSharkURL,
        })
        .onConflict('key')
        .merge({ value: normalizedEssentialMindSharkURL });

      const response: FrontendLinksResponse = {
        essentialMindSharkURL: normalizedEssentialMindSharkURL,
      };

      return res.json(response);
    } catch (error) {
      console.error('Error updating frontend link settings:', error);
      return res.status(500).json({ error: 'Failed to update frontend links' });
    }
  },
);

export default router;
