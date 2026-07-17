import React from 'react';
import {
  Alert,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useRecoilValue } from 'recoil';
import { CurrentUserSignupStatus } from '../state/store';
import SignupIssues from './SignupIssues';

const generateTableRow = (criteria: string, status: boolean, help: string) => (
  <TableRow
    key={criteria}
    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
  >
    <TableCell component="th" scope="row">
      {criteria}
    </TableCell>
    <TableCell component="th" scope="row">
      {status ? (
        <ThumbUpIcon color="success" />
      ) : (
        <ThumbDownIcon color="error" />
      )}
    </TableCell>
    <TableCell>
      <Typography>{help}</Typography>
      <IconButton />
    </TableCell>
  </TableRow>
);

function UserStatusTable() {
  const signupStatus = useRecoilValue(CurrentUserSignupStatus);

  return (
    <>
      <SignupIssues />
      {signupStatus.hasCustomRequirements && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your shift requirements were adjusted for this plan
          {signupStatus.requirementExceptionReason
            ? `: ${signupStatus.requirementExceptionReason}`
            : '.'}
        </Alert>
      )}
      <TableContainer>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Criteria</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Help</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {generateTableRow(
              'Signed up for this years roster',
              signupStatus.hasSignedUpForRoster,
              "If you can see this table you've already signed up. Congrats.",
            )}
            {generateTableRow(
              'Public profile is complete',
              signupStatus.hasCompletedPublicProfile,
              'You can edit your profile by clicking the Profile Edit menu item on the left.',
            )}
            {generateTableRow(
              'Private profile is complete',
              signupStatus.hasCompletedPrivateProfile,
              'You can edit your profile by clicking the Profile Edit menu item on the left.',
            )}
            {generateTableRow(
              'Your account has been verified',
              signupStatus.isVerified,
              'Your account must be verified in order for you to signup for chores and view the roster. You can verify your account by reaching out to your most familiar council member.',
            )}
            {generateTableRow(
              'Dues have been paid',
              signupStatus.hasPaidDues,
              'You can pay your dues by clicking the Pay Dues menu item on the left.',
            )}
            {signupStatus.choreSignupsOpen &&
              generateTableRow(
                `Chore shifts selected (${signupStatus.choreShiftCount}/${signupStatus.requirements.chore})`,
                signupStatus.choreShiftCount >= signupStatus.requirements.chore,
                signupStatus.requirements.chore === 0
                  ? 'You are exempt from chore shifts for this plan.'
                  : `Select ${signupStatus.requirements.chore} chore shift${
                      signupStatus.requirements.chore === 1 ? '' : 's'
                    } from the Shifts page.`,
              )}
            {signupStatus.choreSignupsOpen &&
              generateTableRow(
                `Event shifts selected (${signupStatus.eventShiftCount}/${signupStatus.requirements.event})`,
                signupStatus.eventShiftCount >= signupStatus.requirements.event,
                signupStatus.requirements.event === 0
                  ? 'You are exempt from event shifts for this plan.'
                  : `Select ${signupStatus.requirements.event} event shift${
                      signupStatus.requirements.event === 1 ? '' : 's'
                    } from the Shifts page.`,
              )}
            {signupStatus.choreSignupsOpen &&
              generateTableRow(
                `Dinner shifts selected (${signupStatus.dinnerShiftCount}/${signupStatus.requirements.dinner})`,
                signupStatus.dinnerShiftCount >=
                  signupStatus.requirements.dinner,
                signupStatus.requirements.dinner === 0
                  ? 'You are exempt from dinner shifts for this plan.'
                  : `Select ${signupStatus.requirements.dinner} dinner shift${
                      signupStatus.requirements.dinner === 1 ? '' : 's'
                    } from the Shifts page.`,
              )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default UserStatusTable;
