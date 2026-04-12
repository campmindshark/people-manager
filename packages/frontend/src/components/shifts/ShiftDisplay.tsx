import React, { useEffect, useMemo, useState } from 'react';
import { useRecoilValue, useRecoilValueLoadable } from 'recoil';
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
import { CurrentRosterState } from '../../state/roster';
import BackendShiftClient from '../../api/shifts/shifts';
import { getFrontendConfig } from '../../config/config';
import ShiftBlock from './ShiftBlock';
import ShiftStack from './ShiftStack';

interface DayBounds {
  start: Date;
  end: Date;
}

const frontendConfig = getFrontendConfig();

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

const getDefaultDayBounds = (year: number): DayBounds => ({
  start: new Date(year, 7, 24),
  end: new Date(year, 8, 1),
});

const startOfDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

export default function ShiftDisplay() {
  const currentRoster = useRecoilValue(CurrentRosterState);
  const schedules = useRecoilValueLoadable(CurrentRosterScheduleState);
  const shiftClient = useMemo(
    () => new BackendShiftClient(frontendConfig.BackendURL),
    [],
  );
  const defaultBounds = useMemo(
    () => getDefaultDayBounds(currentRoster.year),
    [currentRoster.year],
  );
  const scheduleIDs =
    schedules.state === 'hasValue'
      ? schedules.contents.map((schedule) => schedule.id)
      : [];
  const scheduleIDsKey = scheduleIDs.join(',');
  const [dayBounds, setDayBounds] = useState<DayBounds>(defaultBounds);
  const [currentDay, setCurrentDay] = useState(defaultBounds.start);

  useEffect(() => {
    setDayBounds(defaultBounds);
    setCurrentDay(defaultBounds.start);
  }, [defaultBounds]);

  useEffect(() => {
    const loadShiftDayBounds = async () => {
      if (schedules.state !== 'hasValue' || scheduleIDs.length === 0) {
        setDayBounds(defaultBounds);
        return;
      }

      const shiftViewModelsBySchedule = await Promise.all(
        scheduleIDs.map((scheduleID) =>
          shiftClient.GetShiftViewModelsBySchedule(scheduleID),
        ),
      );

      const allShifts = shiftViewModelsBySchedule.flatMap((shiftViewModels) =>
        shiftViewModels.map((shiftViewModel) => shiftViewModel.shift),
      );

      if (allShifts.length === 0) {
        setDayBounds(defaultBounds);
        return;
      }

      const [firstShift, ...remainingShifts] = allShifts;
      let minStart = new Date(firstShift.startTime);
      let maxEnd = new Date(firstShift.endTime);

      remainingShifts.forEach((shift) => {
        const shiftStart = new Date(shift.startTime);
        const shiftEnd = new Date(shift.endTime);

        if (shiftStart < minStart) {
          minStart = shiftStart;
        }
        if (shiftEnd > maxEnd) {
          maxEnd = shiftEnd;
        }
      });

      setDayBounds({
        start: startOfDay(minStart),
        end: endOfDay(maxEnd),
      });
    };

    loadShiftDayBounds().catch((error) => {
      console.error('Failed to load shift bounds, using fallback:', error);
      setDayBounds(defaultBounds);
    });
  }, [
    defaultBounds,
    scheduleIDsKey,
    scheduleIDs.length,
    schedules.state,
    shiftClient,
  ]);

  useEffect(() => {
    if (currentDay < dayBounds.start || currentDay > dayBounds.end) {
      setCurrentDay(dayBounds.start);
    }
  }, [currentDay, dayBounds.end, dayBounds.start]);

  const timeSlots = useMemo(
    () => generateDailyTimeSlots(dayBounds.start, dayBounds.end),
    [dayBounds.end, dayBounds.start],
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
