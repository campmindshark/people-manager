import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChorePlanStatus,
  ChorePlanSummary,
} from 'backend/view_models/chore_plan';
import { plannedShiftSummary, PlanSummary } from './AdminChorePlanner';

function plan(status: ChorePlanStatus): ChorePlanSummary {
  const opened = status !== 'draft';
  const closed = status === 'closed';
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
    openedAt: opened ? '2026-07-18T12:00:00.000Z' : null,
    openedBy: opened ? { id: 10, name: 'Alex Admin' } : null,
    closedAt: closed ? '2026-07-19T12:00:00.000Z' : null,
    closedBy: closed ? { id: 11, name: 'Casey Closer' } : null,
    updatedAt: '2026-07-18T12:00:00.000Z',
  };
}

test('shows open signup status and allows an admin to close signups', () => {
  const handleToggle = jest.fn();
  render(
    <PlanSummary
      plan={plan('open')}
      year={2026}
      loading={false}
      onToggleSignups={handleToggle}
    />,
  );

  expect(
    screen.getByText('Chore signups are open for 2026.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /close chore signups/i }));
  expect(handleToggle).toHaveBeenCalledTimes(1);
});

test('shows draft signup status and allows an admin to open signups', () => {
  render(
    <PlanSummary
      plan={plan('draft')}
      year={2026}
      loading={false}
      onToggleSignups={jest.fn()}
    />,
  );

  expect(
    screen.getByText('Chore signups are in draft for 2026.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /open chore signups/i }),
  ).toBeInTheDocument();
});

test('shows retained lifecycle history and allows a closed plan to reopen', () => {
  const handleToggle = jest.fn();
  render(
    <PlanSummary
      plan={plan('closed')}
      year={2026}
      loading={false}
      onToggleSignups={handleToggle}
    />,
  );

  expect(
    screen.getByText('Chore signups are closed for 2026.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Last opened Jul 18, 2026, 5:00 AM by Alex Admin.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Last closed Jul 19, 2026, 5:00 AM by Casey Closer.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /open chore signups/i }));
  expect(handleToggle).toHaveBeenCalledTimes(1);
});

test('distinguishes dated shifts from their available signup spots', () => {
  const shifts = Array.from({ length: 18 }, (_, index) => ({
    requiredParticipants: index < 14 ? 3 : 2,
  }));

  expect(plannedShiftSummary(shifts)).toBe(
    '50 signup spots across 18 dated shifts',
  );
  expect(plannedShiftSummary([{ requiredParticipants: 1 }])).toBe(
    '1 signup spot across 1 dated shift',
  );
});
