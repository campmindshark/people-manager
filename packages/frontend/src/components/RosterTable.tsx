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

const skillsString = (skills: string[]): string => {
  if (!skills || skills.length === 0) {
    return '';
  }
  let skillString = '';
  for (let i = 0; i < skills.length; i += 1) {
    skillString += skills[i];
    if (i < skills.length - 1) {
      skillString += ', ';
    }
  }
  return skillString;
};

function RosterTable() {
  const participants = useRecoilValue(CurrentRosterParticipantsState);

  return (
    <Table sx={{ minWidth: 650 }} aria-label="simple table">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Playa Name</TableCell>
          <TableCell>Location</TableCell>
          <TableCell>Probability of Attending</TableCell>

          <TableCell>Ticket</TableCell>
          <TableCell>Extra Tickets</TableCell>

          <TableCell>Years Attended</TableCell>
          <TableCell>Years At Camp</TableCell>
          <TableCell>Referral Name</TableCell>
          <TableCell>Sleeping Arrangement</TableCell>
          <TableCell>Skills</TableCell>
          <TableCell>Interested in EA</TableCell>
          <TableCell>Interested in Post Burn</TableCell>
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
              {participant.user.playaName}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.user.location}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.probabilityOfAttending}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.hasTicket ? 'Yes' : 'No'}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.extraTickets ? 'Yes' : 'No'}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.yearsAttended}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.yearsAtCamp.join(', ')}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.user.referralName}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.sleepingArrangement}
            </TableCell>
            <TableCell component="th" scope="row">
              {skillsString(participant.user.skillsOfNote)},
              {participant.user.skillsNotInList}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.earlyArrivalInterest
                ? 'Yes'
                : 'No'}
            </TableCell>
            <TableCell component="th" scope="row">
              {participant.rosterParticipant.postBurnInterest ? 'Yes' : 'No'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default RosterTable;
