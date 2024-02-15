import React from 'react';
import {
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useRecoilValue } from 'recoil';
import User from 'backend/models/user/user';
import { MyShifts } from '../state/store';
import BurningManDateFormatter from '../utils/datetime/formatter';

function MyShiftsTable() {
  const shifts = useRecoilValue(MyShifts);

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
      <h1>My Chores</h1>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Shift Name</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>End Time</TableCell>
              <TableCell>Participants</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow
                key={shift.shift.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {shift.scheduleName}
                </TableCell>
                <TableCell component="th" scope="row">
                  {BurningManDateFormatter.format(
                    new Date(shift.shift.startTime),
                  )}
                </TableCell>
                <TableCell component="th" scope="row">
                  {BurningManDateFormatter.format(
                    new Date(shift.shift.endTime),
                  )}
                </TableCell>
                <TableCell component="th" scope="row">
                  {shift.participants
                    .map((participant) => {
                      const participantUser = User.fromJson(participant);
                      return participantUser.displayName();
                    })
                    .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default MyShiftsTable;
