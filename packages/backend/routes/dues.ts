import express from 'express';
import DuesController from '../controllers/dues';
import hasPermission from '../middleware/rbac';
import verifiedUserMiddleware from '../middleware/verified_user';

const router = express.Router();

router.get('/participants', verifiedUserMiddleware, hasPermission('rosterParticipant:dues'), async (req, res) => {
  try {
    const participants = await DuesController.getCurrentRosterParticipantsWithDues();
    res.json(participants);
  } catch (error) {
    console.error('Error fetching dues participants:', error);
    res.status(500).json({ error: 'Failed to fetch dues participants' });
  }
});

router.put('/payment/:userID', verifiedUserMiddleware, hasPermission('rosterParticipant:dues'), async (req, res) => {
  try {
    const userID = parseInt(req.params.userID, 10);
    const { paid, amount, paymentMethod } = req.body;

    const currentRoster = await DuesController.getCurrentRoster();
    if (!currentRoster) {
      return res.status(404).json({ error: 'No current roster found' });
    }

    const payment = await DuesController.updateDuesPayment(
      userID,
      currentRoster.id,
      paid,
      amount,
      paymentMethod
    );

    return res.json(payment);
  } catch (error) {
    console.error('Error updating dues payment:', error);
    return res.status(500).json({ error: 'Failed to update dues payment' });
  }
});

export default router;