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
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import BackendDuesClient, { DuesParticipantInfo, DuesPaymentUpdate } from '../../api/dues/client';
import { getFrontendConfig } from '../../config/config';
import BackendRosterClient from '../../api/roster/roster';

const duesClient = new BackendDuesClient(getFrontendConfig().BackendURL);
const rosterClient = new BackendRosterClient(getFrontendConfig().BackendURL);

interface PaymentDetailsDialogProps {
  open: boolean;
  participant: DuesParticipantInfo | null;
  onClose: () => void;
  onSave: (userID: number, payment: DuesPaymentUpdate) => void;
}

function PaymentDetailsDialog({ open, participant, onClose, onSave }: PaymentDetailsDialogProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');

  useEffect(() => {
    if (participant) {
      setAmount(participant.amount?.toString() || '');
      setPaymentMethod(participant.paymentMethod || '');
      // Format date for input field (YYYY-MM-DD format)
      const date = participant.paymentDate || new Date();
      setPaymentDate(date.toISOString().split('T')[0]);
    }
  }, [participant]);

  const handleSave = () => {
    if (participant) {
      onSave(participant.userID, {
        paid: true,
        amount: amount || undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
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
          <TextField
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

type SortField = 'name' | 'email' | 'paid' | 'amount' | 'paymentMethod' | 'paymentDate';
type SortDirection = 'asc' | 'desc';

export default function DuesManagementTable() {
  const [participants, setParticipants] = useState<DuesParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRosterID, setCurrentRosterID] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<DuesParticipantInfo | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Filtering state
  const [nameFilter, setNameFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');

  const fetchParticipants = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // First, get all rosters and find the most recent one (current roster)
      const rosters = await rosterClient.GetAllRosters();
      
      if (rosters.length === 0) {
        setError('No rosters found. Please create a roster first.');
        setParticipants([]);
        return;
      }
      
      // Get the most recent roster (highest year)
      const currentRoster = rosters.reduce((latest, roster) => 
        roster.year > latest.year ? roster : latest
      );
      
      setCurrentRosterID(currentRoster.id);
      
      const data = await duesClient.GetRosterParticipantsWithDues(currentRoster.id);
      setParticipants(data);
    } catch (err) {
      console.error('Error fetching participants:', err);
      let errorMessage = 'Failed to load participants. Please try refreshing the page.';
      
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
        console.error('Error details:', axiosError.response?.data);
        
        if (axiosError.response?.status === 401) {
          errorMessage = 'You are not authorized to view this data. Please check your permissions.';
        } else if (axiosError.response?.status === 403) {
          errorMessage = 'You do not have permission to access dues management.';
        } else if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        }
      }
      
      setError(errorMessage);
      setParticipants([]);
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
        if (!currentRosterID) {
          setError('No current roster available');
          return;
        }
        await duesClient.UpdateDuesPayment(userID, currentRosterID, { paid: false });
        await fetchParticipants();
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError('Failed to update payment status. Please try again.');
    }
  };

  const handlePaymentDetailsSave = async (userID: number, payment: DuesPaymentUpdate) => {
    try {
      if (!currentRosterID) {
        setError('No current roster available');
        return;
      }
      await duesClient.UpdateDuesPayment(userID, currentRosterID, payment);
      await fetchParticipants();
    } catch (err) {
      console.error('Error updating payment details:', err);
      setError('Failed to update payment details. Please try again.');
    }
  };

  const handleEditDetails = (participant: DuesParticipantInfo) => {
    setSelectedParticipant(participant);
    setDetailsDialogOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort participants
  const filteredAndSortedParticipants = participants
    .filter(participant => {
      // Name filter
      if (nameFilter && !`${participant.firstName} ${participant.lastName}`.toLowerCase().includes(nameFilter.toLowerCase())) {
        return false;
      }
      
      // Payment status filter
      if (paymentStatusFilter === 'paid' && !participant.paid) return false;
      if (paymentStatusFilter === 'unpaid' && participant.paid) return false;
      
      // Payment method filter
      if (paymentMethodFilter !== 'all' && participant.paymentMethod !== paymentMethodFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortField) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'paid':
          aValue = a.paid ? 1 : 0;
          bValue = b.paid ? 1 : 0;
          break;
        case 'amount':
          aValue = Number(a.amount || 0);
          bValue = Number(b.amount || 0);
          break;
        case 'paymentMethod':
          aValue = a.paymentMethod || '';
          bValue = b.paymentMethod || '';
          break;
        case 'paymentDate':
          aValue = a.paymentDate ? a.paymentDate.getTime() : 0;
          bValue = b.paymentDate ? b.paymentDate.getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Get unique payment methods for filter dropdown
  const uniquePaymentMethods = Array.from(new Set(participants
    .map(p => p.paymentMethod)
    .filter(method => method && method.trim() !== '')
  ));

  if (loading) {
    return <Typography>Loading participants...</Typography>;
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="outlined" 
          onClick={fetchParticipants}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (participants.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="textSecondary" gutterBottom>
          No roster participants found. Make sure there are users signed up for the current roster.
        </Typography>
        <Button 
          variant="outlined" 
          onClick={fetchParticipants}
          sx={{ mt: 2 }}
        >
          Refresh
        </Button>
      </Box>
    );
  }

  return (
    <>
      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters ({filteredAndSortedParticipants.length} of {participants.length} participants)
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Search by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Enter name..."
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Payment Status</InputLabel>
              <Select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
                label="Payment Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="unpaid">Unpaid</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                label="Payment Method"
              >
                <MenuItem value="all">All</MenuItem>
                {uniquePaymentMethods.map(method => (
                  <MenuItem key={method} value={method}>{method}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortDirection : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'email'}
                  direction={sortField === 'email' ? sortDirection : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'paid'}
                  direction={sortField === 'paid' ? sortDirection : 'asc'}
                  onClick={() => handleSort('paid')}
                >
                  Paid
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'amount'}
                  direction={sortField === 'amount' ? sortDirection : 'asc'}
                  onClick={() => handleSort('amount')}
                >
                  Amount
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'paymentMethod'}
                  direction={sortField === 'paymentMethod' ? sortDirection : 'asc'}
                  onClick={() => handleSort('paymentMethod')}
                >
                  Payment Method
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'paymentDate'}
                  direction={sortField === 'paymentDate' ? sortDirection : 'asc'}
                  onClick={() => handleSort('paymentDate')}
                >
                  Payment Date
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedParticipants.map((participant) => (
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
                  {participant.amount ? `$${Number(participant.amount).toFixed(2)}` : '-'}
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
                    ? participant.paymentDate.toLocaleDateString() 
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
