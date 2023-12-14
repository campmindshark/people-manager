import React, { useState } from 'react';
import { useRecoilValueLoadable } from 'recoil';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import {
  AppBar,
  Box,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import CurrentRosterScheduleState from '../../state/schedules';
import ShiftBlock from './ShiftBlock';
import ShiftStack from './ShiftStack';

const generateTimeSlotsByInterval = (
  intervalMins: number,
  start: Date,
  end: Date,
) => {
  const timeSlots: Date[] = [];
  for (
    let time = start;
    time <= end;
    time.setMinutes(time.getMinutes() + intervalMins)
  ) {
    timeSlots.push(new Date(time));
  }
  return timeSlots;
};

const generateDailyTimeSlots = (startDay: Date, endDay: Date) => {
  const start = new Date(startDay);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDay);
  end.setHours(23, 59, 59, 999);
  const timeSlots = generateTimeSlotsByInterval(60, start, end);
  return timeSlots;
};

export default function ShiftDisplay() {
  const [currentDay, setCurrentDay] = useState(new Date('08/24/2024'));
  const schedules = useRecoilValueLoadable(CurrentRosterScheduleState);
  const [timeSlots, _] = useState<Date[]>(
    generateDailyTimeSlots(new Date('08/24/2024'), new Date('09/01/2024')),
  );

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

  function generateShiftStacks() {
    const shiftStacks: JSX.Element[] = [];
    switch (schedules.state) {
      case 'hasError':
        return <Typography>Error loading schedules</Typography>;
      case 'loading':
        return <Typography>Loading schedules...</Typography>;
      case 'hasValue':
        schedules.contents.forEach((schedule) => {
          shiftStacks.push(
            <Grid item key={`schedule-column-${schedule.id}`}>
              <ShiftStack schedule={schedule} />
            </Grid>,
          );
        });
        break;
      default:
        return <Typography>Unknown state</Typography>;
    }

    return shiftStacks;
  }

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
        <Grid container>
          <Grid item>
            <Stack>
              <ShiftBlock />
              {timeSlots.map((timeSlot) => (
                <ShiftBlock key={`time-slot-${timeSlot}`}>
                  {timeSlot.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    weekday: 'short',
                  })}
                </ShiftBlock>
              ))}
            </Stack>
          </Grid>
          {generateShiftStacks()}
        </Grid>
      </Box>
    </TableContainer>
  );
}
