import React from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useRecoilValue } from 'recoil';
import RosterParticipantViewModel from 'backend/view_models/roster_participant';
import { CurrentRosterParticipantsState } from '../state/roster';

function RosterTable() {
  const participants = useRecoilValue(CurrentRosterParticipantsState);

  return (
    <Table sx={{ minWidth: 650 }} aria-label="simple table">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Probability of Attending</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {participants.map((participant: RosterParticipantViewModel) => (
          <TableRow
            key={participant.user.id}
            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
          >
            <TableCell component="th" scope="row">
              {participant.user.firstName} {participant.user.lastName}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.probabilityOfAttending}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default RosterTable;
