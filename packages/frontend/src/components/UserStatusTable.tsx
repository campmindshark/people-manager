import React from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useRecoilValue } from 'recoil';
import { UserIsSignedUpForCurrentRoster } from '../state/store';

function UserStatusTable() {
  const appUserIsSignedUpForCurrentBurn = useRecoilValue(
    UserIsSignedUpForCurrentRoster,
  );

  const generateTableRow = (criteria: string, status: boolean) => (
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
    </TableRow>
  );

  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Criteria</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {generateTableRow(
            'Signed up for this years roster',
            appUserIsSignedUpForCurrentBurn,
          )}
          {generateTableRow('Public profile is complete', true)}
          {generateTableRow('Private profile is complete', false)}
          {generateTableRow('Dues have been paid', true)}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default UserStatusTable;
