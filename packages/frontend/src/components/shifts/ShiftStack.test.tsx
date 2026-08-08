import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import Schedule from 'backend/models/schedule/schedule';
import Shift from 'backend/models/shift/shift';
import BackendShiftClient from 'src/api/shifts/shifts';
import ShiftStack from './ShiftStack';

jest.mock('./ShiftBlock', () => ({
  __esModule: true,
  default: ({
    isEmptySlot,
    timeFrameMinutes,
  }: {
    isEmptySlot?: boolean;
    timeFrameMinutes?: number;
  }) => (
    <div
      data-testid={isEmptySlot ? 'empty-shift-block' : 'shift-block'}
      data-time-frame-minutes={timeFrameMinutes}
    />
  ),
}));

test('positions shifts from Pacific midnight', async () => {
  jest
    .spyOn(BackendShiftClient.prototype, 'GetShiftViewModelsBySchedule')
    .mockResolvedValue([
      {
        shift: Shift.fromJson({
          id: 1,
          scheduleID: 1,
          startTime: new Date('2026-08-24T16:00:00.000Z'),
          endTime: new Date('2026-08-24T17:00:00.000Z'),
          requiredParticipants: 1,
        }),
        scheduleName: 'Test schedule',
        participants: [],
      },
    ]);

  const schedule = Schedule.fromJson({
    id: 1,
    rosterID: 1,
    name: 'Test schedule',
    description: 'Pacific-time layout test',
  });

  render(
    <RecoilRoot>
      <ShiftStack schedule={schedule} />
    </RecoilRoot>,
  );

  expect(await screen.findByTestId('empty-shift-block')).toHaveAttribute(
    'data-time-frame-minutes',
    '540',
  );
});
