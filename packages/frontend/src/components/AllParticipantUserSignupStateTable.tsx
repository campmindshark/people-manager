import React from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useRecoilValue } from 'recoil';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { CurrentRosterParticipantsSignupStatusState } from '../state/roster';

const generateIcon = (status: boolean) => {
  if (status) {
    return <ThumbUpIcon color="success" />;
  }
  return <ThumbDownIcon color="error" />;
};

export default function AllParticipantUserSignupStateTable() {
  const signupStatuses = useRecoilValue(
    CurrentRosterParticipantsSignupStatusState,
  );

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Participant</TableCell>
            <TableCell>Public Profile</TableCell>
            <TableCell>Private Profile</TableCell>
            <TableCell>Paid Dues</TableCell>
            <TableCell>Shift Count</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {signupStatuses.map((status) => (
            <TableRow key={status.user.id}>
              <TableCell>
                {status.user.firstName} {status.user.lastName}
              </TableCell>
              <TableCell>
                {generateIcon(status.hasCompletedPublicProfile)}
              </TableCell>
              <TableCell>
                {generateIcon(status.hasCompletedPrivateProfile)}
              </TableCell>
              <TableCell>{generateIcon(status.hasPaidDues)}</TableCell>
              <TableCell>{status.shiftCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
