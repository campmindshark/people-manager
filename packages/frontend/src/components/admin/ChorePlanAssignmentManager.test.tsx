import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Roster from 'backend/models/roster/roster';
import { ChorePlanAdminAssignmentViewResponse } from 'backend/view_models/chore_plan_assignments';
import ChorePlanAssignmentManager, {
  ChorePlanAdminAssignmentClient,
  ChorePlanAdminAssignmentRosterClient,
} from './ChorePlanAssignmentManager';

const firstShift = {
  id: 11,
  stableKey: 'chore|1|am',
  kind: 'chore' as const,
  scheduleName: 'AM Chum Wench',
  displayDayLabel: 'Sunday, Aug 30',
  timePeriodLabel: '11:00 AM',
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
    plan: { id: 3, status: 'open', planningYear: 2026 },
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
    ],
    shifts: [firstShift, secondShift],
    ...overrides,
  };
}

function clients(view = assignmentView()): {
  planClient: ChorePlanAdminAssignmentClient;
  rosterClient: ChorePlanAdminAssignmentRosterClient;
} {
  return {
    planClient: {
      GetAdminAssignments: jest.fn().mockResolvedValue(view),
      MutateAdminAssignments: jest
        .fn()
        .mockResolvedValue({ changed: true, forced: false, bypassedRules: [] }),
      ForceAdminAssignments: jest.fn().mockResolvedValue({
        changed: true,
        forced: true,
        bypassedRules: ['capacity:shift:12'],
      }),
    },
    rosterClient: {
      GetAllRosters: jest
        .fn()
        .mockResolvedValue([{ id: 2, year: 2026 } as Roster]),
    },
  };
}

async function choose(label: string, option: string | RegExp): Promise<void> {
  userEvent.click(screen.getByLabelText(label));
  userEvent.click(await screen.findByRole('option', { name: option }));
}

test('renders identities and sends a narrow assign mutation before refreshing', async () => {
  const { planClient, rosterClient } = clients();
  render(
    <ChorePlanAssignmentManager
      planClient={planClient}
      rosterClient={rosterClient}
    />,
  );

  expect(await screen.findByText('Plan open')).toBeVisible();
  expect(screen.getByText('Alpha Camper (A)')).toBeVisible();
  expect(screen.getByText('Beta Camper')).toBeVisible();
  await choose('Participant', 'Alpha Camper (A)');
  await choose('Shift', /PM Chum Wench/);
  userEvent.click(screen.getByRole('button', { name: 'Run assign' }));

  await waitFor(() =>
    expect(planClient.MutateAdminAssignments).toHaveBeenCalledWith(2, {
      operation: 'assign',
      userID: 21,
      shiftID: 12,
    }),
  );
  expect(await screen.findByText('Assign completed.')).toBeVisible();
  expect(planClient.GetAdminAssignments).toHaveBeenCalledTimes(2);
});

test('uses the separate force endpoint with an exact move and trimmed reason', async () => {
  const { planClient, rosterClient } = clients();
  render(
    <ChorePlanAssignmentManager
      planClient={planClient}
      rosterClient={rosterClient}
    />,
  );

  expect(await screen.findByText('Plan open')).toBeVisible();
  await choose('Operation', 'Move');
  await choose('Participant', 'Alpha Camper (A)');
  await choose('Source shift', /AM Chum Wench/);
  await choose('Destination shift', /PM Chum Wench/);
  userEvent.click(
    screen.getByRole('checkbox', { name: /force rule conflicts/i }),
  );
  userEvent.type(screen.getByLabelText(/force reason/i), '  Approved cover  ');
  userEvent.click(screen.getByRole('button', { name: 'Run move' }));

  await waitFor(() =>
    expect(planClient.ForceAdminAssignments).toHaveBeenCalledWith(2, {
      mutation: {
        operation: 'move',
        userID: 21,
        fromShiftID: 11,
        toShiftID: 12,
      },
      reason: 'Approved cover',
    }),
  );
  expect(planClient.MutateAdminAssignments).not.toHaveBeenCalled();
  expect(await screen.findByText(/bypassed capacity:shift:12/i)).toBeVisible();
});

test('keeps closed assignment state visible and disables mutations', async () => {
  const { planClient, rosterClient } = clients(
    assignmentView({
      plan: { id: 3, status: 'closed', planningYear: 2026 },
      mutationsAllowed: false,
    }),
  );
  render(
    <ChorePlanAssignmentManager
      planClient={planClient}
      rosterClient={rosterClient}
    />,
  );

  expect(await screen.findByText('Plan closed')).toBeVisible();
  expect(screen.getByText(/reopen the plan/i)).toBeVisible();
  expect(screen.getByText('AM Chum Wench', { exact: false })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Run assign' })).toBeDisabled();
});

test('surfaces authoritative backend conflicts without refreshing', async () => {
  const { planClient, rosterClient } = clients();
  planClient.MutateAdminAssignments = jest.fn().mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'The proposed assignment state exceeds shift capacity.' },
    },
  });
  render(
    <ChorePlanAssignmentManager
      planClient={planClient}
      rosterClient={rosterClient}
    />,
  );

  expect(await screen.findByText('Plan open')).toBeVisible();
  await choose('Participant', 'Alpha Camper (A)');
  await choose('Shift', /PM Chum Wench/);
  userEvent.click(screen.getByRole('button', { name: 'Run assign' }));

  expect(await screen.findByText(/exceeds shift capacity/i)).toBeVisible();
  expect(planClient.GetAdminAssignments).toHaveBeenCalledTimes(1);
});
