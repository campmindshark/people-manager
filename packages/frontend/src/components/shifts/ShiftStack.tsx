import React, { useEffect, useMemo } from 'react';
import Schedule from 'backend/models/schedule/schedule';
import { Stack } from '@mui/material';
import Shift from 'backend/models/shift/shift';
import BackendShiftClient from 'src/api/shifts/shifts';
import { getConfig } from 'backend/config/config';
import ShiftBlock from './ShiftBlock';

const appConfig = getConfig();

interface Props {
  schedule: Schedule;
  timeSlots: Date[];
}

export default function ShiftStack(props: Props) {
  const shiftClient = useMemo(
    () => new BackendShiftClient(appConfig.BackendURL),
    [appConfig.BackendURL],
  );
  const { schedule, timeSlots } = props;
  const [shifts, setShifts] = React.useState<Shift[]>([]);

  // should only use this at the top level
  useEffect(() => {
    const fetchShifts = async () => {
      const loadedShifts = await shiftClient.GetShiftsBySchedule(schedule.id);
      setShifts(loadedShifts);
    };
    fetchShifts();
  }, [schedule]);

  const generateShiftBlocks = () => {
    console.log(shifts);
    const shiftBlocks: JSX.Element[] = [];
    console.log(timeSlots);
    const startTime = new Date(timeSlots[0]);
    for (let index = 0; index < shifts.length; index += 1) {
      const shift = Shift.fromJson(shifts[index]);
      const differenceBetweenStartTimes =
        new Date(shift.startTime).getTime() - startTime.getTime();
      shiftBlocks.push(
        <ShiftBlock timeFrameMinutes={differenceBetweenStartTimes / 600000}>
          EMPTY
        </ShiftBlock>,
      );
      shiftBlocks.push(
        <ShiftBlock timeFrameMinutes={shift.getLengthMinutes()}>
          {new Date(shift.startTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
          })}
        </ShiftBlock>,
      );
      startTime.setTime(new Date(shift.endTime).getTime());
    }

    return shiftBlocks;
  };

  return (
    <Stack>
      <ShiftBlock>{schedule.name}</ShiftBlock>
      {generateShiftBlocks()}
      {timeSlots.map((timeSlot) => (
        <ShiftBlock>
          {timeSlot.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
          })}
        </ShiftBlock>
      ))}
    </Stack>
  );
}
