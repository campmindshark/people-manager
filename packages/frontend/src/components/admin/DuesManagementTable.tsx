import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  TextField,
  MenuItem,
  Chip,
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import BackendDuesClient, { DuesParticipantInfo, DuesPaymentUpdate } from '../../api/dues/client';
import { getFrontendConfig } from '../../config/config';

const duesClient = new BackendDuesClient(getFrontendConfig().BackendURL);

interface PaymentDetailsDialogProps {
  open: boolean;
  participant: DuesParticipantInfo | null;
  onClose: () => void;
  onSave: (userID: number, payment: DuesPaymentUpdate) => void;
}

function PaymentDetailsDialog({ open, participant, onClose, onSave }: PaymentDetailsDialogProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  useEffect(() => {
    if (participant) {
      setAmount(participant.amount?.toString() || '');
      setPaymentMethod(participant.paymentMethod || '');
    }
  }, [participant]);

  const handleSave = () => {
    if (participant) {
      onSave(participant.userID, {
        paid: true,
        amount: amount ? parseFloat(amount) : undefined,
        paymentMethod: paymentMethod || undefined,
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Payment Details - {participant?.firstName} {participant?.lastName}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
            fullWidth
          />
          <TextField
            label="Payment Method"
            select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            fullWidth
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="venmo">Venmo</MenuItem>
            <MenuItem value="zelle">Zelle</MenuItem>
            <MenuItem value="check">Check</MenuItem>
            <MenuItem value="paypal">PayPal</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DuesManagementTable() {
  const [participants, setParticipants] = useState<DuesParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<DuesParticipantInfo | null>(null);

  const fetchParticipants = async () => {
    try {
      const data = await duesClient.GetCurrentRosterParticipantsWithDues();
      console.log('Fetched participants:', data);
      setParticipants(data);
      if (data.length === 0) {
        console.warn('No roster participants found. Make sure there are users signed up for the current roster.');
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      } else if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: unknown } };
        console.error('Error details:', axiosError.response?.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  const handlePaidToggle = async (userID: number, paid: boolean) => {
    try {
      if (paid) {
        // Open details dialog for setting amount and payment method
        const participant = participants.find(p => p.userID === userID);
        setSelectedParticipant(participant || null);
        setDetailsDialogOpen(true);
      } else {
        // Mark as unpaid directly
        await duesClient.UpdateDuesPayment(userID, { paid: false });
        await fetchParticipants();
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handlePaymentDetailsSave = async (userID: number, payment: DuesPaymentUpdate) => {
    try {
      await duesClient.UpdateDuesPayment(userID, payment);
      await fetchParticipants();
    } catch (error) {
      console.error('Error updating payment details:', error);
    }
  };

  const handleEditDetails = (participant: DuesParticipantInfo) => {
    setSelectedParticipant(participant);
    setDetailsDialogOpen(true);
  };

  if (loading) {
    return <Typography>Loading participants...</Typography>;
  }

  if (participants.length === 0) {
    return (
      <Typography color="textSecondary">
        No roster participants found. Make sure there are users signed up for the current roster.
      </Typography>
    );
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="center">Paid</TableCell>
              <TableCell align="center">Amount</TableCell>
              <TableCell align="center">Payment Method</TableCell>
              <TableCell align="center">Payment Date</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={participant.userID}>
                <TableCell>
                  {participant.firstName} {participant.lastName}
                </TableCell>
                <TableCell>{participant.email}</TableCell>
                <TableCell align="center">
                  <Switch
                    checked={participant.paid}
                    onChange={(e) => handlePaidToggle(participant.userID, e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="center">
                  {participant.amount ? `$${participant.amount.toFixed(2)}` : '-'}
                </TableCell>
                <TableCell align="center">
                  {participant.paymentMethod ? (
                    <Chip 
                      label={participant.paymentMethod} 
                      size="small" 
                      variant="outlined" 
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell align="center">
                  {participant.paymentDate 
                    ? new Date(participant.paymentDate).toLocaleDateString() 
                    : '-'
                  }
                </TableCell>
                <TableCell align="center">
                  {participant.paid && (
                    <IconButton
                      size="small"
                      onClick={() => handleEditDetails(participant)}
                      title="Edit payment details"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PaymentDetailsDialog
        open={detailsDialogOpen}
        participant={selectedParticipant}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedParticipant(null);
        }}
        onSave={handlePaymentDetailsSave}
      />
    </>
  );
}
