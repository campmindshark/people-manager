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
}

export default function ShiftStack(props: Props) {
  const shiftClient = useMemo(
    () => new BackendShiftClient(appConfig.BackendURL),
    [appConfig.BackendURL],
  );
  const { schedule } = props;
  const [shifts, setShifts] = React.useState<Shift[]>([]);

  // should only use this at the top level
  useEffect(() => {
    const fetchShifts = async () => {
      const loadedShifts = await shiftClient.GetShiftsBySchedule(schedule.id);
      setShifts(loadedShifts);
    };
    fetchShifts().catch(console.error);
  }, [schedule]);

  const generateShiftBlocks = () => {
    console.log('generateShiftBlocks');
    const shiftBlocks: JSX.Element[] = [];

    const lastEndTime = new Date('08/24/2024 00:00:00');
    console.log(`lastEndTime: ${lastEndTime}`);
    for (let index = 0; index < shifts.length; index += 1) {
      const shift = Shift.fromJson(shifts[index]);
      const differenceBetweenStartTimes =
        new Date(shift.startTime).getTime() - lastEndTime.getTime();
      const differenceBetweenStartTimesMinutes =
        differenceBetweenStartTimes / 60000;

      console.log(
        `${new Date(
          shift.startTime,
        )} - ${lastEndTime} = ${differenceBetweenStartTimesMinutes} minutes`,
      );

      if (differenceBetweenStartTimesMinutes > 0) {
        console.log(`adding empty block ${differenceBetweenStartTimesMinutes}`);
        shiftBlocks.push(
          <ShiftBlock
            timeFrameMinutes={differenceBetweenStartTimesMinutes}
            isEmptySlot
          />,
        );
      }

      shiftBlocks.push(
        <ShiftBlock timeFrameMinutes={shift.getLengthMinutes()}>
          {new Date(shift.startTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
          })}
        </ShiftBlock>,
      );
      lastEndTime.setTime(new Date(shift.endTime).getTime());
    }

    console.log('shiftBlocks');
    console.log(shiftBlocks);

    return shiftBlocks;
  };

  return (
    <Stack>
      <ShiftBlock>{schedule.name}</ShiftBlock>
      {generateShiftBlocks().map((shiftBlock) => shiftBlock)}
    </Stack>
  );
}
