import React from 'react';
import {
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
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

function generateVerifyTableRows(
  users: Loadable<User[]>,
  reloadCB: () => void,
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
            >
              Verify User
            </Button>
            <Button variant="outlined" color="error">
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

  return (
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
          {generateVerifyTableRows(unverifiedUsers, updateUnverifiedUsers)}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default VerifyUsersTable;
