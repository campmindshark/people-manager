import express, { Request, Response, Router } from 'express';
import Group from '../models/group/group';
import hasPermission from '../middleware/rbac';
import GroupController from '../controllers/group';

const router: Router = express.Router();

/* GET all group viewModels. */
router.get(
  '/viewModels',
  hasPermission('groups:readAll'),
  async (req: Request, res: Response) => {
    const groups = await Group.query();

    const viewModels = await GroupController.GetGroupViewModels(groups);
    res.json(viewModels);
  },
);

/* GET a group by ID. */
router.get(
  '/:id',
  hasPermission('groups:read'),
  async (req: Request, res: Response) => {
    const groupID = req.params.id;

    const group = await Group.query().findById(groupID);

    if (!group) {
      res.status(404).send('Group not found');
      return;
    }

    res.json(group);
  },
);

/* POST a new group. */
router.post(
  '/',
  hasPermission('groups:create'),
  async (req: Request, res: Response) => {
    const newGroup = req.body;

    console.log(newGroup);

    const group = await Group.query().insert(newGroup);

    res.json(group);
  },
);

/* UPDATE a group. */
router.put(
  '/:id',
  hasPermission('groups:edit'),
  async (req: Request, res: Response) => {
    const updatedGroup = req.body;
    const groupID = req.params.id;

    const group = await Group.query().findById(groupID);

    if (!group) {
      res.status(404).send('Group not found');
      return;
    }

    await Group.query().findById(groupID).patch(updatedGroup);

    res.json(updatedGroup);
  },
);

// GET members of a group
router.get(
  '/:id/members',
  hasPermission('groups:readMembers'),
  async (req: Request, res: Response) => {
    const groupID = req.params.id;

    if (!groupID || groupID === 'undefined') {
      res.status(400).send('Group ID is required');
      return;
    }

    const members = await Group.relatedQuery('members').for(groupID);

    if (!members) {
      res.status(404).send('Members not found');
      return;
    }

    res.json(members);
  },
);

// POST a new member to a group
router.post(
  '/:id/members/:memberID',
  hasPermission('groups:addMember'),
  async (req: Request, res: Response) => {
    const groupID = req.params.id;
    const newMemberID = req.params.memberID;
    // const newMember = req.body;

    if (!groupID || groupID === 'undefined') {
      res.status(400).send('Group ID is required');
      return;
    }

    if (!newMemberID || newMemberID === 'undefined') {
      res.status(400).send('Member ID is required');
      return;
    }

    const group = await Group.query().findById(groupID);

    if (!group) {
      res.status(404).send('Group not found');
      return;
    }

    await group.$relatedQuery('members').relate(newMemberID);

    res.json(true);
  },
);

// DELETE a member from a group
router.delete(
  '/:id/members/:memberID',
  hasPermission('groups:removeMember'),
  async (req: Request, res: Response) => {
    const groupID = req.params.id;
    const memberID = req.params.memberID;

    if (!groupID || groupID === 'undefined') {
      res.status(400).send('Group ID is required');
      return;
    }

    if (!memberID || memberID === 'undefined') {
      res.status(400).send('Member ID is required');
      return;
    }

    const group = await Group.query().findById(groupID);

    if (!group) {
      res.status(404).send('Group not found');
      return;
    }

    await group.$relatedQuery('members').unrelate().where('id', memberID);

    res.json(true);
  },
);

export default router;
