import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChorePlanReadinessResponse } from 'backend/view_models/chore_plan_readiness';
import {
  ChorePlanReadinessDashboard,
  ChorePlanReadinessReviewDialog,
} from './ChorePlanReadinessDashboard';

function readiness(): ChorePlanReadinessResponse {
  return {
    planID: 4,
    rosterID: 2,
    status: 'open',
    plannerHeadcount: 50,
    actualRosterCount: 48,
    headcountDifference: -2,
    categories: {
      chore: {
        kind: 'chore',
        completeParticipants: 30,
        incompleteParticipants: 18,
        assignedShifts: 120,
        requiredShifts: 141,
      },
      event: {
        kind: 'event',
        completeParticipants: 28,
        incompleteParticipants: 20,
        assignedShifts: 116,
        requiredShifts: 141,
      },
      dinner: {
        kind: 'dinner',
        completeParticipants: 44,
        incompleteParticipants: 4,
        assignedShifts: 44,
        requiredShifts: 47,
      },
    },
    underfilledShifts: [
      {
        shiftID: 10,
        scheduleName: 'Kitchen cleanup',
        startTime: '2026-08-25T16:00:00.000Z',
        endTime: '2026-08-25T17:00:00.000Z',
        requiredParticipants: 4,
        assignedParticipants: 2,
        status: 'underfilled',
      },
    ],
    fullShifts: [],
    overfilledShifts: [],
    incompleteParticipants: [
      {
        userID: 7,
        name: 'Sparkles (Sam S.)',
        missing: { chore: 2, dinner: 1 },
      },
    ],
    feasibilityIssues: [
      {
        userID: 7,
        name: 'Sparkles (Sam S.)',
        kind: 'dinner',
        reason: 'outside_attendance',
        message: 'Every remaining shift falls outside the attendance window.',
      },
    ],
    participantDataIssues: [
      {
        userID: 8,
        name: 'Taylor T.',
        missing: ['private_profile', 'attendance_window'],
      },
    ],
    requirementExceptions: [
      {
        userID: 9,
        name: 'Riley R.',
        type: 'exemption',
        requirements: { chore: 0, event: 0, dinner: 0 },
        reason: 'Medical exemption',
      },
      {
        userID: 12,
        name: 'Alex A.',
        type: 'override',
        requirements: { chore: 1, event: 2, dinner: 1 },
        reason: 'Late arrival',
      },
    ],
    generatedAt: '2026-08-07T12:00:00.000Z',
  };
}

test('shows headcount, unique-assignment completion, feasibility, participant data, and exceptions', () => {
  render(<ChorePlanReadinessDashboard readiness={readiness()} />);

  expect(screen.getByText(/Planner headcount:/)).toHaveTextContent(
    'Planner headcount: 50 · Actual roster: 48',
  );
  expect(screen.getByText('30 complete · 18 incomplete')).toBeVisible();
  expect(
    screen.getByText('120 of 141 required participant assignments'),
  ).toBeVisible();
  userEvent.click(screen.getByText('Underfilled shifts'));
  expect(
    screen.getByText('Kitchen cleanup · Tue, Aug 25, 9:00 AM'),
  ).toBeVisible();
  expect(
    screen.getByText(
      'Every remaining shift falls outside the attendance window.',
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      'Missing or incomplete: private profile, attendance window',
    ),
  ).toBeVisible();
  expect(screen.getByText('Exemptions (1)')).toBeVisible();
  expect(screen.getByText('Overrides (1)')).toBeVisible();
  expect(screen.getByText(/Medical exemption/)).toBeVisible();
});

test('requires a loaded readiness snapshot before confirming lifecycle changes', () => {
  const onConfirm = jest.fn();
  const { rerender } = render(
    <ChorePlanReadinessReviewDialog
      action="close"
      confirming={false}
      error={null}
      loading
      onClose={jest.fn()}
      onConfirm={onConfirm}
      onRetry={jest.fn()}
      open
      readiness={null}
    />,
  );

  expect(screen.getByRole('button', { name: 'Confirm close' })).toBeDisabled();
  rerender(
    <ChorePlanReadinessReviewDialog
      action="close"
      confirming={false}
      error={null}
      loading={false}
      onClose={jest.fn()}
      onConfirm={onConfirm}
      onRetry={jest.fn()}
      open
      readiness={readiness()}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
