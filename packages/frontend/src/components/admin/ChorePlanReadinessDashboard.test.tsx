import React, { useState } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { ChorePlanReadiness } from 'backend/view_models/chore_plan';
import {
  ChorePlanReadinessDashboard,
  ChorePlanReadinessReviewDialog,
} from './ChorePlanReadinessDashboard';

function readiness(): ChorePlanReadiness {
  return {
    planID: 4,
    rosterID: 2,
    plannerHeadcount: 50,
    actualRosterCount: 48,
    headcountDifference: -2,
    categories: {
      chore: {
        kind: 'chore',
        completeMembers: 30,
        incompleteMembers: 18,
        assignedSpots: 120,
        requiredSpots: 141,
      },
      event: {
        kind: 'event',
        completeMembers: 28,
        incompleteMembers: 20,
        assignedSpots: 116,
        requiredSpots: 141,
      },
      dinner: {
        kind: 'dinner',
        completeMembers: 44,
        incompleteMembers: 4,
        assignedSpots: 44,
        requiredSpots: 47,
      },
    },
    underfilledShifts: [
      {
        shiftID: 10,
        scheduleName: 'Kitchen cleanup',
        startTime: '2026-08-25T16:00:00.000Z',
        endTime: '2026-08-25T17:00:00.000Z',
        requiredParticipants: 4,
        participantCount: 2,
        status: 'underfilled',
      },
    ],
    fullShifts: [
      {
        shiftID: 11,
        scheduleName: 'Dinner prep',
        startTime: '2026-08-25T23:00:00.000Z',
        endTime: '2026-08-26T01:00:00.000Z',
        requiredParticipants: 3,
        participantCount: 3,
        status: 'full',
      },
    ],
    overfilledShifts: [],
    incompleteMembers: [
      {
        userID: 7,
        name: 'Sparkles (Sam S.)',
        missing: { chore: 2, dinner: 1 },
      },
    ],
    noFeasibleChoices: [
      {
        userID: 7,
        name: 'Sparkles (Sam S.)',
        kind: 'dinner',
        reason: 'Every remaining shift falls outside the attendance window.',
      },
    ],
    requirementExceptions: [
      {
        userID: 9,
        name: 'Taylor T.',
        type: 'exemption',
        requirements: { chore: 0, event: 0, dinner: 0 },
        reason: 'Medical exemption',
      },
      {
        userID: 12,
        name: 'Riley R.',
        type: 'override',
        requirements: { chore: 1, event: 2, dinner: 1 },
        reason: 'Late arrival',
      },
    ],
    generatedAt: '2026-07-19T12:00:00.000Z',
  };
}

function ReviewDialogHarness({
  action,
  onConfirm,
}: {
  action: 'open' | 'close';
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <ChorePlanReadinessReviewDialog
      open={open}
      action={action}
      readiness={readiness()}
      loading={false}
      error={null}
      confirming={false}
      onClose={() => setOpen(false)}
      onConfirm={onConfirm}
      onRetry={jest.fn()}
    />
  );
}

test('shows headcount, category completion, capacity, feasibility, and exceptions', () => {
  render(<ChorePlanReadinessDashboard readiness={readiness()} />);

  expect(screen.getByText(/Planner headcount:/)).toHaveTextContent(
    'Planner headcount: 50 · Actual roster: 48',
  );
  expect(screen.getByText('30 complete · 18 incomplete')).toBeInTheDocument();
  expect(screen.getByText('Underfilled shifts')).toBeInTheDocument();
  expect(screen.getByText('Full shifts')).toBeInTheDocument();
  expect(
    screen.getByText(
      'Every remaining shift falls outside the attendance window.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Exemptions (1)')).toBeInTheDocument();
  expect(screen.getByText('Overrides (1)')).toBeInTheDocument();
  expect(
    screen.getByText('Medical exemption', { exact: false }),
  ).toBeInTheDocument();
});

describe.each(['open', 'close'] as const)('%s signups review', (action) => {
  test('dismisses the dialog when canceled', async () => {
    const onConfirm = jest.fn();
    render(<ReviewDialogHarness action={action} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('dismisses the dialog and confirms the lifecycle action', async () => {
    const onConfirm = jest.fn();
    render(<ReviewDialogHarness action={action} onConfirm={onConfirm} />);

    expect(screen.getByRole('dialog')).toHaveTextContent(
      `Readiness before ${action === 'open' ? 'opening' : 'closing'}`,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Admin readiness');
    fireEvent.click(screen.getByRole('button', { name: `Confirm ${action}` }));

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
