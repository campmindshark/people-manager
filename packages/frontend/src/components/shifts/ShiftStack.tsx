import React, { useEffect, useMemo, useState } from 'react';
import Schedule from 'backend/models/schedule/schedule';
import { Stack, Typography } from '@mui/material';
import Shift from 'backend/models/shift/shift';
import ShiftViewModel from 'backend/view_models/shift';
import { getConfig } from 'backend/config/config';
import BackendShiftClient from 'src/api/shifts/shifts';
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
  const [shiftViewModels, setShifts] = useState<ShiftViewModel[]>([]);

  // should only use this at the top level
  useEffect(() => {
    const fetchShifts = async () => {
      const loadedShifts = await shiftClient.GetShiftViewModelsBySchedule(
        schedule.id,
      );
      setShifts(loadedShifts);
    };
    fetchShifts().catch(console.error);
  }, [schedule]);

  const generateShiftBlocks = () => {
    const shiftBlocks: JSX.Element[] = [];

    const lastEndTime = new Date('08/24/2024 00:00:00');
    for (let index = 0; index < shiftViewModels.length; index += 1) {
      const shift = Shift.fromJson(shiftViewModels[index].shift);
      const differenceBetweenStartTimes =
        new Date(shift.startTime).getTime() - lastEndTime.getTime();
      const differenceBetweenStartTimesMinutes =
        differenceBetweenStartTimes / 60000;

      if (differenceBetweenStartTimesMinutes > 0) {
        shiftBlocks.push(
          <ShiftBlock
            timeFrameMinutes={differenceBetweenStartTimesMinutes}
            isEmptySlot
            key={`shift-block-${index}-${schedule.id}-offset`}
          />,
        );
      }

      shiftBlocks.push(
        <ShiftBlock
          timeFrameMinutes={shift.getLengthMinutes()}
          shiftViewModel={shiftViewModels[index]}
          key={`shift-block-${index}-${schedule.id}`}
        >
          <Typography variant="caption" display="block">
            ({shiftViewModels[index].participants.length}/
            {shift.requiredParticipants})
          </Typography>
        </ShiftBlock>,
      );
      lastEndTime.setTime(new Date(shift.endTime).getTime());
    }

    return shiftBlocks;
  };

  return (
    <Stack>
      <ShiftBlock>{schedule.name}</ShiftBlock>
      {generateShiftBlocks()}
    </Stack>
  );
}
