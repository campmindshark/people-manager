import React, { useState } from 'react';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
// import Table from '@mui/material/Table';
// import TableBody from '@mui/material/TableBody';
// import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
// import TableHead from '@mui/material/TableHead';
// import TableRow from '@mui/material/TableRow';
import Schedule from 'backend/models/schedule/schedule';
// import Shift from 'backend/models/shift/shift';
import Paper from '@mui/material/Paper';
import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material';
import DayShifts from './DayShifts';

const getStubSchedules = (): Schedule[] => {
  const stubs: Schedule[] = [];
  stubs.push(new Schedule(1, 'Schedule 1', 'This is a schedule'));
  stubs.push(new Schedule(2, 'Schedule 2', 'This is a second schedule'));

  return stubs;
};

export default function ShiftDisplay() {
  const [currentDay, setCurrentDay] = React.useState(new Date('08/24/2024'));
  const [_schedules, _] = useState<Schedule[]>(getStubSchedules());

  const handleDayChange = (change: number) => {
    const newDate = new Date(currentDay);
    newDate.setDate(newDate.getDate() + change);
    setCurrentDay(newDate);
  };

  const handleNextDay = () => {
    handleDayChange(1);
  };

  const handlePreviousDay = () => {
    handleDayChange(-1);
  };

  return (
    <TableContainer component={Paper}>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {currentDay.toLocaleDateString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}{' '}
              Shifts
            </Typography>
            <IconButton onClick={handlePreviousDay}>
              <ArrowLeftIcon />
            </IconButton>
            <IconButton onClick={handleNextDay}>
              <ArrowRightIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DayShifts />
      </Box>
    </TableContainer>
  );
}
