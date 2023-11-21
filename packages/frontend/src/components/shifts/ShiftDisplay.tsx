import React, { useState, useEffect, useMemo } from 'react';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import TableContainer from '@mui/material/TableContainer';
import Schedule from 'backend/models/schedule/schedule';
import Paper from '@mui/material/Paper';
import { getConfig } from 'backend/config/config';
import {
  AppBar,
  Box,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import BackendScheduleClient from 'src/api/schedules/schedules';
import { ShiftBlock } from './ShiftBlock';
import ShiftStack from './ShiftStack';

const appConfig = getConfig();

const generateTimeSlotsByInterval = (
  intervalMins: number,
  start: Date,
  end: Date,
) => {
  const timeSlots = [];
  for (
    let time = start;
    time <= end;
    time.setMinutes(time.getMinutes() + intervalMins)
  ) {
    timeSlots.push(new Date(time));
  }
  return timeSlots;
};

const generateDailyTimeSlots = (targetDay: Date) => {
  const start = new Date(targetDay);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDay);
  end.setHours(23, 59, 59, 999);
  const timeSlots = generateTimeSlotsByInterval(60, start, end);
  return timeSlots;
};

export default function ShiftDisplay() {
  const scheduleClient = useMemo(
    () => new BackendScheduleClient(appConfig.BackendURL),
    [appConfig.BackendURL],
  );

  const [currentDay, setCurrentDay] = React.useState(new Date('08/24/2024'));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [timeSlots, _] = useState<Date[]>(generateDailyTimeSlots(currentDay));

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

  useEffect(() => {
    scheduleClient.GetAllSchedules().then((loadedSchedules) => {
      setSchedules(loadedSchedules);
    });
  }, [currentDay]);

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
                <ShiftBlock>
                  {timeSlot.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                  })}
                </ShiftBlock>
              ))}
            </Stack>
          </Grid>
          {schedules.map((schedule) => (
            <Grid item>
              <ShiftStack schedule={schedule} timeSlots={timeSlots} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </TableContainer>
  );
}
