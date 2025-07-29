import React, { useState } from 'react';
import {
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Loadable,
  useRecoilRefresher_UNSTABLE,
  useRecoilValueLoadable,
} from 'recoil';
import User from 'backend/models/user/user';
import UnverifiedUserState from '../state/users';
import BackendUserClient from '../api/users/client';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();
const userClient = new BackendUserClient(frontendConfig.BackendURL);

async function verifyUser(user: User, cb: () => void) {
  console.log('Verifying user:', user);

  await userClient.VerifyUser(user.id);
  cb();
}

async function blockUser(user: User, cb: () => void, setMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void) {
  console.log('Blocking user:', user);

  try {
    const result = await userClient.BlockUser(user.id);
    setMessage({ type: 'success', text: result.message });
    cb();
  } catch (error) {
    setMessage({ type: 'error', text: `Failed to block user: ${error}` });
  }
}

function generateVerifyTableRows(
  users: Loadable<User[]>,
  reloadCB: () => void,
  openBlockDialog: (user: User) => void,
) {
  switch (users.state) {
    case 'hasValue':
      return users.contents.map((user) => (
        <TableRow key={user.id}>
          <TableCell>
            {user.firstName} {user.lastName}
          </TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.location}</TableCell>
          <TableCell>
            <Button
              variant="outlined"
              color="success"
              onClick={() => verifyUser(user, reloadCB)}
              sx={{ mr: 1 }}
            >
              Verify User
            </Button>
            <Button 
              variant="outlined" 
              color="error"
              onClick={() => openBlockDialog(user)}
            >
              Block User
            </Button>
          </TableCell>
        </TableRow>
      ));
    case 'loading':
      return <TableRow>Loading...</TableRow>;
    case 'hasError':
      return <TableRow>Error: {users.contents.message}</TableRow>;
    default:
      return <TableRow>Something went wrong</TableRow>;
  }
}

function VerifyUsersTable() {
  const unverifiedUsers = useRecoilValueLoadable(UnverifiedUserState);
  const updateUnverifiedUsers =
    useRecoilRefresher_UNSTABLE(UnverifiedUserState);
  
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<User | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const openBlockDialog = (user: User) => {
    setUserToBlock(user);
    setBlockDialogOpen(true);
  };

  const handleBlockUser = async () => {
    if (userToBlock) {
      await blockUser(userToBlock, updateUnverifiedUsers, setMessage);
      setBlockDialogOpen(false);
      setUserToBlock(null);
    }
  };

  return (
    <>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      
      <TableContainer>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {generateVerifyTableRows(unverifiedUsers, updateUnverifiedUsers, openBlockDialog)}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
      >
        <DialogTitle>Confirm User Block</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to block user &quot;{userToBlock?.firstName} {userToBlock?.lastName}&quot;? 
            This will prevent them from logging into the system entirely.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleBlockUser} color="error">
            Block User
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default VerifyUsersTable;
