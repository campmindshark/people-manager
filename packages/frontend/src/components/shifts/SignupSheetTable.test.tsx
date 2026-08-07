import React from 'react';
import { render, screen, within } from '@testing-library/react';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';

test('renders one canonical set of event periods and keeps after-midnight shifts on their display day', () => {
  const shifts: SignupSheetShift[] = [
    {
      key: 'sunday-noon',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '12p-3p',
      periodOrder: 1,
    },
    {
      key: 'sunday-afternoon',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '3p-6p',
      periodOrder: 2,
    },
    {
      key: 'sunday-evening',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '6p-9p',
      periodOrder: 3,
    },
    {
      key: 'sunday-night',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '9p-12a',
      periodOrder: 4,
    },
    {
      key: 'monday-after-midnight',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '12a-3a',
      periodOrder: 5,
    },
    {
      key: 'monday-noon',
      scheduleName: 'Bar',
      day: 2,
      timePeriod: '12p-3p',
      periodOrder: 7,
    },
    {
      key: 'closing-sunday-after-midnight',
      scheduleName: 'Bar',
      day: 7,
      timePeriod: '12a-3a',
      periodOrder: 39,
    },
  ];

  render(
    <SignupSheetTable
      emptyCellContent={null}
      kind="event"
      shifts={shifts}
      renderShift={(shift) => shift.key}
    />,
  );

  expect(
    screen.getAllByRole('columnheader').map((heading) => heading.textContent),
  ).toEqual([
    'Day',
    'Shift',
    '12 pm - 3 pm',
    '3 pm - 6 pm',
    '6 pm - 9 pm',
    '9 pm - 12 am',
    '12 am - 3 am',
  ]);

  const dayRows = screen
    .getAllByRole('row')
    .filter((row) => within(row).queryByText(/^(Sunday|Monday|Saturday)$/));
  const sundayRow = dayRows.find((row) => within(row).queryByText('Sunday'));
  const mondayRow = dayRows.find((row) => within(row).queryByText('Monday'));
  const saturdayRow = dayRows.find((row) =>
    within(row).queryByText('Saturday'),
  );
  if (!sundayRow || !mondayRow || !saturdayRow) {
    throw new Error('Expected Sunday, Monday, and Saturday event rows.');
  }

  expect(
    within(sundayRow).getByText('monday-after-midnight'),
  ).toBeInTheDocument();
  expect(within(mondayRow).getByText('monday-noon')).toBeInTheDocument();
  expect(
    within(saturdayRow).getByText('closing-sunday-after-midnight'),
  ).toBeInTheDocument();
  expect(
    within(mondayRow).queryByText('monday-after-midnight'),
  ).not.toBeInTheDocument();
});
