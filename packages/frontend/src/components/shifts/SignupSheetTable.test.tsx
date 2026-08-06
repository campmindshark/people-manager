import React from 'react';
import { render, screen, within } from '@testing-library/react';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';

test('renders the event week Sunday through Saturday and keeps closing Sunday periods in Saturday', () => {
  const shifts: SignupSheetShift[] = [
    {
      key: 'opening-sunday',
      scheduleName: 'Bar',
      day: 1,
      timePeriod: '12p-3p',
      periodOrder: 1,
    },
    {
      key: 'closing-sunday-midnight',
      scheduleName: 'Bar',
      day: 7,
      timePeriod: '12a-3a',
      periodOrder: 5,
    },
    {
      key: 'closing-sunday-late',
      scheduleName: 'Bar',
      day: 7,
      timePeriod: '3a-6a',
      periodOrder: 6,
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

  const dayRows = screen
    .getAllByRole('row')
    .filter((row) => within(row).queryByText(/^(Sunday|Saturday)$/));
  const sundayRow = dayRows.find((row) => within(row).queryByText('Sunday'));
  const saturdayRow = dayRows.find((row) =>
    within(row).queryByText('Saturday'),
  );
  if (!sundayRow || !saturdayRow) {
    throw new Error('Expected Sunday and Saturday event rows.');
  }

  expect(within(sundayRow).getByText('opening-sunday')).toBeInTheDocument();
  expect(
    within(saturdayRow).getByText('closing-sunday-midnight'),
  ).toBeInTheDocument();
  expect(
    within(saturdayRow).getByText('closing-sunday-late'),
  ).toBeInTheDocument();
  expect(within(saturdayRow).queryByText('opening-sunday')).toBeNull();
});
