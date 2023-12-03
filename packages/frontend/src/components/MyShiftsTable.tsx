import React, { useEffect } from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useRecoilValue } from 'recoil';
import { MyShifts } from '../state/store';

const options: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Los_Angeles', // Set the timezone to Reno, Nevada (America/Los_Angeles)
  weekday: 'long', // Format options
  // year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};

const bmDateFormatter = new Intl.DateTimeFormat('en-US', options);

function MyShiftsTable() {
  const shifts = useRecoilValue(MyShifts);

  useEffect(() => {
    console.log(shifts);
  }, [shifts]);

  return (
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
                {bmDateFormatter.format(shift.shift.startTime)}
              </TableCell>
              <TableCell component="th" scope="row">
                {bmDateFormatter.format(shift.shift.endTime)}
              </TableCell>
              <TableCell component="th" scope="row">
                {shift.participants.join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default MyShiftsTable;
