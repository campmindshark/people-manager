import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChorePlanAdminAssignmentViewResponse } from 'backend/view_models/chore_plan_assignments';
import ChorePlanAssignmentManager, {
  ChorePlanAdminAssignmentClient,
} from './ChorePlanAssignmentManager';

const firstShift = {
  id: 11,
  stableKey: 'chore|1|am',
  kind: 'chore' as const,
  scheduleName: 'AM Chum Wench',
  displayDayNumber: 1,
  displayDayLabel: 'Sunday, Aug 30',
  timePeriodLabel: '11:00 AM',
  periodOrder: null,
  startTime: '2026-08-30T18:00:00.000Z',
  endTime: '2026-08-30T19:00:00.000Z',
  requiredParticipants: 2,
  assignedUserIDs: [21],
};

const secondShift = {
  ...firstShift,
  id: 12,
  stableKey: 'chore|1|pm',
  scheduleName: 'PM Chum Wench',
  timePeriodLabel: '5:00 PM',
  startTime: '2026-08-31T00:00:00.000Z',
  endTime: '2026-08-31T01:00:00.000Z',
  assignedUserIDs: [22],
};

function assignmentView(
  overrides: Partial<ChorePlanAdminAssignmentViewResponse> = {},
): ChorePlanAdminAssignmentViewResponse {
  return {
    rosterID: 2,
    plan: {
      id: 3,
      status: 'open',
      planningYear: 2026,
      requirements: { chore: 2, event: 1, dinner: 1 },
    },
    mutationsAllowed: true,
    participants: [
      {
        userID: 21,
        firstName: 'Alpha',
        lastName: 'Camper',
        playaName: 'A',
        estimatedArrivalDate: '2026-08-20T00:00:00.000Z',
        estimatedDepartureDate: '2026-09-10T00:00:00.000Z',
        assignedShiftIDs: [11],
      },
      {
        userID: 22,
        firstName: 'Beta',
        lastName: 'Camper',
        playaName: '',
        estimatedArrivalDate: '2026-08-20T00:00:00.000Z',
        estimatedDepartureDate: '2026-09-10T00:00:00.000Z',
        assignedShiftIDs: [12],
      },
      {
        userID: 23,
        firstName: 'Gamma',
        lastName: 'Camper',
        playaName: '',
        estimatedArrivalDate: '2026-08-20T00:00:00.000Z',
        estimatedDepartureDate: '2026-09-10T00:00:00.000Z',
        assignedShiftIDs: [],
      },
    ],
    shifts: [firstShift, secondShift],
    ...overrides,
  };
}

function planClient(view = assignmentView()): ChorePlanAdminAssignmentClient {
  return {
    GetAdminAssignments: jest.fn().mockResolvedValue(view),
    MutateAdminAssignments: jest
      .fn()
      .mockResolvedValue({ changed: true, forced: false, bypassedRules: [] }),
    ForceAdminAssignments: jest.fn().mockResolvedValue({
      changed: true,
      forced: true,
      bypassedRules: ['capacity:shift:12'],
    }),
  };
}

async function choosePerson(option: string | RegExp): Promise<void> {
  userEvent.click(
    screen.getByLabelText(/Person (needing shifts|to force assign)/),
  );
  userEvent.click(await screen.findByRole('option', { name: option }));
}

test('renders PR 58 signup sheets without repeating lifecycle status', async () => {
  const client = planClient();
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  expect(await screen.findByLabelText('Person needing shifts')).toBeEnabled();
  expect(
    screen.queryByText('Chore signups are open for 2026.'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Alpha Camper (A)')).toBeVisible();
  expect(screen.getByText('Beta Camper')).toBeVisible();
  expect(screen.getAllByText('Open spot')).toHaveLength(2);
});

test('assigns a selected person by clicking an open signup-sheet spot', async () => {
  const client = planClient();
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  await screen.findByLabelText('Person needing shifts');
  await choosePerson(/Alpha Camper \(A\).*needs/);
  userEvent.click(
    screen.getByRole('button', {
      name: /Add Alpha Camper \(A\) to PM Chum Wench/,
    }),
  );

  await waitFor(() =>
    expect(client.MutateAdminAssignments).toHaveBeenCalledWith(2, {
      operation: 'assign',
      userID: 21,
      shiftID: 12,
    }),
  );
  expect(
    await screen.findByText(/Alpha Camper \(A\) was assigned/),
  ).toBeVisible();
  expect(client.GetAdminAssignments).toHaveBeenCalledTimes(2);
});

test('force-moves a selected participant with an audited reason', async () => {
  const client = planClient();
  render(
    <ChorePlanAssignmentManager
      canForceAssignments
      planClient={client}
      rosterID={2}
    />,
  );

  userEvent.click(
    await screen.findByRole('button', {
      name: /Select Alpha Camper \(A\).*for admin shift editing/,
    }),
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /Select PM Chum Wench.*as move destination/,
    }),
  );
  userEvent.click(
    screen.getByRole('checkbox', {
      name: 'Force (skip safety constraints)',
    }),
  );
  userEvent.type(
    await screen.findByRole('textbox', { name: 'Force reason' }),
    '  Approved cover  ',
  );
  userEvent.click(screen.getByRole('button', { name: 'Force move' }));

  await waitFor(() =>
    expect(client.ForceAdminAssignments).toHaveBeenCalledWith(2, {
      mutation: {
        operation: 'move',
        userID: 21,
        fromShiftID: 11,
        toShiftID: 12,
      },
      reason: 'Approved cover',
    }),
  );
  expect(client.MutateAdminAssignments).not.toHaveBeenCalled();
  expect(await screen.findByText(/bypassed: capacity:shift:12/i)).toBeVisible();
});

test('force-assigns a complete participant directly to a full shift', async () => {
  const client = planClient(
    assignmentView({
      plan: {
        id: 3,
        status: 'open',
        planningYear: 2026,
        requirements: { chore: 0, event: 0, dinner: 0 },
      },
      shifts: [firstShift, { ...secondShift, assignedUserIDs: [21, 22] }],
    }),
  );
  render(
    <ChorePlanAssignmentManager
      canForceAssignments
      planClient={client}
      rosterID={2}
    />,
  );

  userEvent.click(
    await screen.findByRole('checkbox', {
      name: 'Force (skip safety constraints)',
    }),
  );
  await choosePerson(/Gamma Camper.*requirements complete/);
  userEvent.type(
    await screen.findByRole('textbox', { name: 'Force reason' }),
    '  Approved extra coverage  ',
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /Force add Gamma Camper to PM Chum Wench/,
    }),
  );

  await waitFor(() =>
    expect(client.ForceAdminAssignments).toHaveBeenCalledWith(2, {
      mutation: {
        operation: 'assign',
        userID: 23,
        shiftID: 12,
      },
      reason: 'Approved extra coverage',
    }),
  );
  expect(client.MutateAdminAssignments).not.toHaveBeenCalled();
});

test('swaps two selected participants in different shifts', async () => {
  const client = planClient();
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  userEvent.click(
    await screen.findByRole('button', {
      name: /Select Alpha Camper \(A\).*for admin shift editing/,
    }),
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /Select Beta Camper.*for admin shift editing/,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Swap people' }));

  await waitFor(() =>
    expect(client.MutateAdminAssignments).toHaveBeenCalledWith(2, {
      operation: 'swap',
      firstUserID: 21,
      firstShiftID: 11,
      secondUserID: 22,
      secondShiftID: 12,
    }),
  );
  expect(
    await screen.findByText(/selected people were swapped/i),
  ).toBeVisible();
});

test('keeps closed assignments visible and read-only', async () => {
  const client = planClient(
    assignmentView({
      plan: {
        id: 3,
        status: 'closed',
        planningYear: 2026,
        requirements: { chore: 2, event: 1, dinner: 1 },
      },
      mutationsAllowed: false,
    }),
  );
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  expect(await screen.findByText('Alpha Camper (A)')).toBeVisible();
  expect(screen.queryByText(/chore plan is closed/i)).not.toBeInTheDocument();
  expect(screen.getByText('Beta Camper')).toBeVisible();
  expect(screen.getByLabelText('Person needing shifts')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Move person' })).toBeDisabled();
});

test('surfaces authoritative backend conflicts without refreshing', async () => {
  const client = planClient();
  client.MutateAdminAssignments = jest.fn().mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'The proposed assignment state exceeds shift capacity.' },
    },
  });
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  await screen.findByLabelText('Person needing shifts');
  await choosePerson(/Alpha Camper \(A\).*needs/);
  userEvent.click(
    screen.getByRole('button', {
      name: /Add Alpha Camper \(A\) to PM Chum Wench/,
    }),
  );

  expect(await screen.findByText(/exceeds shift capacity/i)).toBeVisible();
  expect(client.GetAdminAssignments).toHaveBeenCalledTimes(1);
});

test('reports a saved mutation when the follow-up refresh fails', async () => {
  const client = planClient();
  client.GetAdminAssignments = jest
    .fn()
    .mockResolvedValueOnce(assignmentView())
    .mockRejectedValueOnce(new Error('refresh failed'));
  render(<ChorePlanAssignmentManager planClient={client} rosterID={2} />);

  userEvent.click(
    await screen.findByRole('button', {
      name: /Select Alpha Camper \(A\).*for admin shift editing/,
    }),
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /Select PM Chum Wench.*as move destination/,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Move person' }));

  expect(await screen.findByText(/Alpha Camper \(A\) was moved/)).toBeVisible();
  expect(
    await screen.findByText(/assignment change was saved.*refresh the page/i),
  ).toBeVisible();
  expect(client.MutateAdminAssignments).toHaveBeenCalledTimes(1);
  expect(client.GetAdminAssignments).toHaveBeenCalledTimes(2);
});
