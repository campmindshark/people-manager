import React, { useEffect, useState } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { RosterParticipantViewModelWithPrivateFields } from 'backend/view_models/roster_participant';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import { CurrentRosterParticipantsDetailedState, CurrentRosterID } from '../state/roster';
import BackendRosterClient from '../api/roster/roster';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);

export default function AdminUserManagement() {
  const setPageState = useSetRecoilState(PageState);
  const participants = useRecoilValue(CurrentRosterParticipantsDetailedState);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<number | null>(null);
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setPageState({
      title: 'Manage Users',
      index: 'admin-users',
    });
  }, [setPageState]);

  const handleSelectUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === participants.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(participants.map(p => p.user.id));
    }
  };

  const handleRemoveSingleUser = async (userId: number) => {
    setLoading(true);
    setMessage(null);
    try {
      await rosterClient.RemoveUserFromRoster(CurrentRosterID, userId);
      setMessage({ type: 'success', text: 'User removed successfully' });
      setConfirmDialogOpen(false);
      setUserToRemove(null);
      window.location.reload();
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to remove user: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedUsers.length === 0) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const result = await rosterClient.RemoveUsersFromRoster(CurrentRosterID, selectedUsers);
      setMessage({ 
        type: 'success', 
        text: `Successfully removed ${result.deletedCount} users from roster` 
      });
      setBulkRemoveDialogOpen(false);
      setSelectedUsers([]);
      window.location.reload();
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to remove users: ${error}` });
    } finally {
      setLoading(false);
    }
  };

  const openSingleRemoveDialog = (userId: number) => {
    setUserToRemove(userId);
    setConfirmDialogOpen(true);
  };

  const openBulkRemoveDialog = () => {
    setBulkRemoveDialogOpen(true);
  };

  const getUserName = (participant: RosterParticipantViewModelWithPrivateFields) => 
    participant.user.displayName ? 
      participant.user.displayName() : 
      `${participant.user.firstName} ${participant.user.lastName}`;

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h4" gutterBottom>
                Manage Current Roster Users
              </Typography>
              
              {message && (
                <Alert severity={message.type} sx={{ mb: 2 }}>
                  {message.text}
                </Alert>
              )}

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={openBulkRemoveDialog}
                  disabled={selectedUsers.length === 0 || loading}
                >
                  Remove Selected ({selectedUsers.length})
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleSelectAll}
                  disabled={participants.length === 0}
                >
                  {selectedUsers.length === participants.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedUsers.length > 0 && selectedUsers.length < participants.length}
                          checked={participants.length > 0 && selectedUsers.length === participants.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Signup Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow key={participant.user.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedUsers.includes(participant.user.id)}
                            onChange={() => handleSelectUser(participant.user.id)}
                          />
                        </TableCell>
                        <TableCell>{getUserName(participant)}</TableCell>
                        <TableCell>{participant.user.email}</TableCell>
                        <TableCell>{participant.privateProfile?.phone || 'N/A'}</TableCell>
                        <TableCell>
                          {participant.signupDate ? 
                            new Date(participant.signupDate).toLocaleDateString() : 
                            'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<PersonRemoveIcon />}
                            onClick={() => openSingleRemoveDialog(participant.user.id)}
                            disabled={loading}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {participants.length === 0 && (
                <Typography variant="body1" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                  No participants found in the current roster.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Single User Remove Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={() => !loading && setConfirmDialogOpen(false)}>
          <DialogTitle>Confirm User Removal</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to remove this user from the current roster? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={() => userToRemove && handleRemoveSingleUser(userToRemove)} 
              color="error"
              disabled={loading}
            >
              Remove User
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Remove Confirmation Dialog */}
        <Dialog open={bulkRemoveDialogOpen} onClose={() => !loading && setBulkRemoveDialogOpen(false)}>
          <DialogTitle>Confirm Bulk User Removal</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to remove {selectedUsers.length} selected users from the current roster? 
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBulkRemoveDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkRemove} 
              color="error"
              disabled={loading}
            >
              Remove {selectedUsers.length} Users
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Dashboard>
  );
}