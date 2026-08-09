import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChorePlanFinalAssignmentsResponse } from 'backend/view_models/chore_plan_final_assignments';
import {
  FinalAssignmentsClient,
  FinalAssignmentsContent,
} from './FinalAssignments';

const response: ChorePlanFinalAssignmentsResponse = {
  rosterID: 2,
  planID: 10,
  status: 'closed',
  planningYear: 2026,
  closedAt: '2026-08-30T12:00:00.000Z',
  assignmentCount: 0,
  categories: [
    { kind: 'chore', shifts: [] },
    { kind: 'event', shifts: [] },
    { kind: 'dinner', shifts: [] },
  ],
};

test('loads the requested roster final assignments', async () => {
  const planClient: FinalAssignmentsClient = {
    GetFinalAssignments: jest.fn().mockResolvedValue(response),
  };
  render(<FinalAssignmentsContent rosterID={2} planClient={planClient} />);

  expect(screen.getByText('Loading final assignments…')).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: '2026 final assignments' }),
  ).toBeInTheDocument();
  expect(planClient.GetFinalAssignments).toHaveBeenCalledWith(2);
});

test('surfaces lifecycle conflicts and retries the snapshot', async () => {
  const planClient: FinalAssignmentsClient = {
    GetFinalAssignments: jest
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: 'Final assignments are available after chore signups close.',
          },
        },
      })
      .mockResolvedValueOnce(response),
  };
  render(<FinalAssignmentsContent rosterID={2} planClient={planClient} />);

  expect(
    await screen.findByText(
      'Final assignments are available after chore signups close.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(planClient.GetFinalAssignments).toHaveBeenCalledTimes(2),
  );
  expect(
    await screen.findByRole('heading', { name: '2026 final assignments' }),
  ).toBeInTheDocument();
});
