import express from 'express';
import DuesController from '../controllers/dues';
import hasPermission from '../middleware/rbac';
import verifiedUserMiddleware from '../middleware/verified_user';

const router = express.Router();

router.get(
  '/participants/:rosterID',
  verifiedUserMiddleware(),
  hasPermission('rosterParticipant:dues'),
  async (req, res) => {
    try {
      const rosterID = parseInt(req.params.rosterID, 10);
      if (Number.isNaN(rosterID)) {
        return res.status(400).json({ error: 'Invalid roster ID' });
      }
      
      const participants = await DuesController.getRosterParticipantsWithDues(rosterID);
      return res.json(participants);
    } catch (error) {
      console.error('Error fetching dues participants:', error);
      return res.status(500).json({ error: 'Failed to fetch dues participants' });
    }
  },
);

router.put(
  '/payment/:userID',
  verifiedUserMiddleware(),
  hasPermission('rosterParticipant:dues'),
  async (req, res) => {
    try {
      const userID = parseInt(req.params.userID, 10);
      const { rosterID, paid, amount, paymentMethod, paymentDate } = req.body;

      if (Number.isNaN(userID)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      if (!rosterID || Number.isNaN(parseInt(rosterID, 10))) {
        return res.status(400).json({ error: 'Roster ID is required' });
      }

      const payment = await DuesController.updateDuesPayment(
        userID,
        parseInt(rosterID, 10),
        paid,
        amount,
        paymentMethod,
        paymentDate ? new Date(paymentDate) : undefined,
      );

      return res.json(payment);
    } catch (error) {
      console.error('Error updating dues payment:', error);
      return res.status(500).json({ error: 'Failed to update dues payment' });
    }
  },
);

export default router;

