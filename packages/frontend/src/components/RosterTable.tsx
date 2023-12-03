import React from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import User from 'backend/models/user/user';
import { useRecoilValue } from 'recoil';
import { CurrentRosterParticipantsState } from '../state/roster';

function RosterTable() {
  const participants = useRecoilValue(CurrentRosterParticipantsState);

  return (
    <Table sx={{ minWidth: 650 }} aria-label="simple table">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>GoogleID</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {participants.map((user: User) => (
          <TableRow
            key={user.id}
            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
          >
            <TableCell component="th" scope="row">
              {user.firstName} {user.lastName}
            </TableCell>
            <TableCell component="th" scope="row">
              {user.googleID}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default RosterTable;
