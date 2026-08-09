import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChorePlanChangeHistoryResponse } from 'backend/view_models/chore_plan_change_history';
import ChorePlanChangeHistoryDialog, {
  ChorePlanChangeHistoryClient,
} from './ChorePlanChangeHistoryDialog';

function history(): ChorePlanChangeHistoryResponse {
  return {
    rosterID: 2,
    hasMore: false,
    entries: [
      {
        id: 4,
        chorePlanID: 3,
        actor: { id: 1, name: 'Admin Actor' },
        action: 'admin_assignment_mutated',
        createdAt: '2026-08-08T15:30:00.000Z',
        details: {
          operation: 'move',
          affectedAssignments: [
            {
              action: 'removed',
              participant: { id: 7, name: 'Sparkles (Sam Camper)' },
              shift: {
                id: 10,
                stableKey: 'chore-old',
                kind: 'chore',
                scheduleName: 'Kitchen cleanup',
                displayDayLabel: 'Tuesday',
                timePeriodLabel: 'Morning',
              },
            },
            {
              action: 'added',
              participant: { id: 7, name: 'Sparkles (Sam Camper)' },
              shift: {
                id: 11,
                stableKey: 'chore-new',
                kind: 'chore',
                scheduleName: 'Dinner cleanup',
                displayDayLabel: 'Wednesday',
                timePeriodLabel: 'Evening',
              },
            },
          ],
          forced: true,
          reason: 'Approved attendance exception',
          bypassedRules: ['attendance:user:7:shift:11', 'capacity:shift:11'],
        },
      },
      {
        id: 3,
        chorePlanID: 3,
        actor: { id: 1, name: 'Admin Actor' },
        action: 'participant_requirements_overridden',
        createdAt: '2026-08-08T14:00:00.000Z',
        details: {
          participant: { id: 8, name: 'Taylor Camper' },
          previousRequirements: { chore: 3, event: 3, dinner: 1 },
          requirements: { chore: 1, event: 2, dinner: 1 },
          previousReason: null,
          reason: 'Late arrival',
          removedAssignments: [],
        },
      },
    ],
  };
}

function clientWith(
  getChangeHistory: (
    rosterID: number,
  ) => Promise<ChorePlanChangeHistoryResponse>,
): ChorePlanChangeHistoryClient {
  return { GetChangeHistory: getChangeHistory };
}

test('shows actor, timestamp, reason, assignment changes, and force details', async () => {
  const getChangeHistory = jest.fn().mockResolvedValue(history());
  render(
    <ChorePlanChangeHistoryDialog
      client={clientWith(getChangeHistory)}
      onClose={jest.fn()}
      open
      rosterID={2}
      rosterYear={2026}
    />,
  );

  expect(
    await screen.findByText('Administrative assignments changed'),
  ).toBeVisible();
  expect(getChangeHistory).toHaveBeenCalledWith(2);
  expect(screen.getAllByText(/Admin Actor ·/)).toHaveLength(2);
  expect(screen.getByText('Forced: yes')).toBeVisible();
  expect(screen.getByText(/Approved attendance exception/)).toBeVisible();
  expect(
    screen.getByText(
      /Removed Sparkles \(Sam Camper\) from Kitchen cleanup \(Tuesday, Morning\) — shift #10/,
    ),
  ).toBeVisible();
  expect(
    screen.getByText(/attendance:user:7:shift:11, capacity:shift:11/),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Changed Taylor Camper's requirements from 3 chore, 3 event, 1 dinner to 1 chore, 2 event, 1 dinner.",
    ),
  ).toBeVisible();
  expect(screen.getByText(/Late arrival/)).toBeVisible();
});

test('shows permission failures and retries the read-only request', async () => {
  const getChangeHistory = jest
    .fn()
    .mockRejectedValueOnce({ response: { status: 403 } })
    .mockResolvedValueOnce({ rosterID: 2, entries: [], hasMore: false });
  render(
    <ChorePlanChangeHistoryDialog
      client={clientWith(getChangeHistory)}
      onClose={jest.fn()}
      open
      rosterID={2}
      rosterYear={2026}
    />,
  );

  expect(
    await screen.findByText(
      'You do not have permission to view chore plan change history.',
    ),
  ).toBeVisible();
  userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(getChangeHistory).toHaveBeenCalledTimes(2));
  expect(
    await screen.findByText(
      'No administrative changes have been recorded yet.',
    ),
  ).toBeVisible();
});
