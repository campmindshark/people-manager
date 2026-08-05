import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChorePlanStatus,
  ChorePlanSummary,
} from 'backend/view_models/chore_plan';
import { ChoreSignupButton } from './ChoreSignupControls';

function plan(status: ChorePlanStatus): ChorePlanSummary {
  return {
    id: 1,
    rosterID: 3,
    camperCount: 50,
    sheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit',
    sheetTitle: 'Chore scores',
    requirements: { chore: 3, event: 3, dinner: 1 },
    scheduleCount: 12,
    shiftCount: 48,
    slotCount: 350,
    status,
    openedAt: status === 'draft' ? null : '2026-07-18T12:00:00.000Z',
    openedBy:
      status === 'draft' ? null : { id: 10, name: 'Alex Administrator' },
    closedAt: status === 'closed' ? '2026-07-19T12:00:00.000Z' : null,
    closedBy: status === 'closed' ? { id: 11, name: 'Casey Closer' } : null,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };
}

test.each<[ChorePlanStatus, string]>([
  ['draft', 'Open Chore Signups'],
  ['open', 'Close Chore Signups'],
  ['closed', 'Open Chore Signups'],
])('shows the appropriate chore signup action', (status, label) => {
  const onToggleSignups = jest.fn();
  render(
    <ChoreSignupButton
      loading={false}
      onToggleSignups={onToggleSignups}
      plan={plan(status)}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: label }));
  expect(onToggleSignups).toHaveBeenCalledTimes(1);
});

test('disables the chore signup action while it is updating', () => {
  render(
    <ChoreSignupButton
      loading
      onToggleSignups={jest.fn()}
      plan={plan('open')}
    />,
  );

  expect(screen.getByRole('button', { name: 'Closing…' })).toBeDisabled();
});

test('shows an opening state when reopening a closed plan', () => {
  render(
    <ChoreSignupButton
      loading
      onToggleSignups={jest.fn()}
      plan={plan('closed')}
    />,
  );

  expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
});
