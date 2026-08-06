import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ChorePlanShiftViewItem,
  ChorePlanShiftViewResponse,
} from 'backend/view_models/chore_plan_shifts';
import ChorePlanShiftView, { ChorePlanShiftClient } from './ChorePlanShiftView';

const shift: ChorePlanShiftViewItem = {
  id: 11,
  stableKey: 'chore|1|am-chum-wench',
  scheduleKey: 'chore|am-chum-wench',
  kind: 'chore',
  scheduleName: 'AM Chum Wench',
  displayDayNumber: 1,
  displayDayLabel: 'Sunday, Aug 30',
  calendarDay: 1,
  timePeriodLabel: '11:00 AM',
  periodOrder: null,
  startTime: '2026-08-30T18:00:00.000Z',
  endTime: '2026-08-30T19:00:00.000Z',
  requiredParticipants: 2,
  assignedParticipantCount: 1,
  currentUserAssigned: true,
  slots: [
    {
      definitionKey: 'chore-am-chum-wench-first',
      positionLabel: 'First',
    },
    {
      definitionKey: 'chore-am-chum-wench-second',
      positionLabel: 'Second',
    },
  ],
};

function response(
  overrides: Partial<ChorePlanShiftViewResponse> = {},
): ChorePlanShiftViewResponse {
  return {
    rosterID: 2,
    plan: null,
    selfServiceMutationsAllowed: false,
    shifts: [],
    ...overrides,
  };
}

function client(result: ChorePlanShiftViewResponse): ChorePlanShiftClient {
  return {
    GetShifts: jest.fn().mockResolvedValue(result),
    Signup: jest
      .fn()
      .mockResolvedValue({ changed: true, assignedShiftIDs: [] }),
    Remove: jest
      .fn()
      .mockResolvedValue({ changed: true, assignedShiftIDs: [] }),
    Switch: jest
      .fn()
      .mockResolvedValue({ changed: true, assignedShiftIDs: [] }),
  };
}

function openResponse(
  shifts: ChorePlanShiftViewItem[],
): ChorePlanShiftViewResponse {
  return response({
    plan: {
      id: 3,
      rosterID: 2,
      status: 'open',
      planningYear: 2026,
      openedAt: '2026-08-06T12:00:00.000Z',
      closedAt: null,
    },
    selfServiceMutationsAllowed: true,
    shifts,
  });
}

test('shows the empty state when the roster has no chore plan', async () => {
  const planClient = client(response());
  render(<ChorePlanShiftView rosterID={2} planClient={planClient} />);

  expect(await screen.findByText(/no chore plan is available/i)).toBeVisible();
  expect(planClient.GetShifts).toHaveBeenCalledWith(2);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('does not reveal generated draft shifts', async () => {
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(
        response({
          plan: {
            id: 3,
            rosterID: 2,
            status: 'draft',
            planningYear: 2026,
            openedAt: null,
            closedAt: null,
          },
        }),
      )}
    />,
  );

  expect(await screen.findByText(/still being prepared/i)).toBeVisible();
  expect(screen.queryByText('AM Chum Wench')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('renders open generated shifts with self-service controls', async () => {
  const eventShift = {
    ...shift,
    id: 12,
    stableKey: 'event|1|gate',
    scheduleKey: 'event|gate',
    kind: 'event' as const,
    scheduleName: 'Gate',
    currentUserAssigned: false,
  };
  const dinnerShift = {
    ...shift,
    id: 13,
    stableKey: 'dinner|1|kitchen',
    scheduleKey: 'dinner|kitchen',
    kind: 'dinner' as const,
    scheduleName: 'Kitchen Dinner',
    currentUserAssigned: false,
  };
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(openResponse([shift, eventShift, dinnerShift]))}
    />,
  );

  expect(await screen.findByText('Plan open')).toBeVisible();
  expect(screen.getByText('AM Chum Wench')).toBeVisible();
  expect(screen.getByText('Gate')).toBeVisible();
  expect(screen.getByText('Kitchen Dinner')).toBeVisible();
  expect(screen.getAllByText('First, Second')).toHaveLength(3);
  expect(screen.getAllByText('1/2')).toHaveLength(3);
  expect(screen.getAllByText('Assigned')).toHaveLength(2);
  expect(
    screen.getByRole('button', { name: 'Remove AM Chum Wench' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Switch from AM Chum Wench' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Sign up for Gate' }),
  ).toBeVisible();
});

test('uses narrow signup, removal, and switch requests then refreshes', async () => {
  const destination = {
    ...shift,
    id: 12,
    stableKey: 'event|1|gate',
    scheduleKey: 'event|gate',
    kind: 'event' as const,
    scheduleName: 'Gate',
    currentUserAssigned: false,
  };

  const signupClient = client(
    openResponse([{ ...shift, currentUserAssigned: false }, destination]),
  );
  const signupRender = render(
    <ChorePlanShiftView rosterID={2} planClient={signupClient} />,
  );
  userEvent.click(
    await screen.findByRole('button', { name: 'Sign up for AM Chum Wench' }),
  );
  await waitFor(() =>
    expect(signupClient.Signup).toHaveBeenCalledWith(2, { shiftID: 11 }),
  );
  expect(await screen.findByText(/signed up for AM Chum Wench/i)).toBeVisible();
  expect(signupClient.GetShifts).toHaveBeenCalledTimes(2);
  signupRender.unmount();

  const removeClient = client(openResponse([shift, destination]));
  const removeRender = render(
    <ChorePlanShiftView rosterID={2} planClient={removeClient} />,
  );
  userEvent.click(
    await screen.findByRole('button', { name: 'Remove AM Chum Wench' }),
  );
  await waitFor(() => expect(removeClient.Remove).toHaveBeenCalledWith(2, 11));
  expect(await screen.findByText(/removed AM Chum Wench/i)).toBeVisible();
  removeRender.unmount();

  const switchClient = client(openResponse([shift, destination]));
  render(<ChorePlanShiftView rosterID={2} planClient={switchClient} />);
  userEvent.click(
    await screen.findByRole('button', { name: 'Switch from AM Chum Wench' }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Switch to Gate' }));
  await waitFor(() =>
    expect(switchClient.Switch).toHaveBeenCalledWith(2, {
      fromShiftID: 11,
      toShiftID: 12,
    }),
  );
  expect(await screen.findByText(/switched to Gate/i)).toBeVisible();
});

test('shows authoritative backend signup conflicts', async () => {
  const planClient = client(
    openResponse([{ ...shift, currentUserAssigned: false }]),
  );
  planClient.Signup = jest.fn().mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'This chore plan shift is full.' },
    },
  });
  render(<ChorePlanShiftView rosterID={2} planClient={planClient} />);

  userEvent.click(
    await screen.findByRole('button', { name: 'Sign up for AM Chum Wench' }),
  );
  expect(await screen.findByText(/chore plan shift is full/i)).toBeVisible();
  expect(planClient.GetShifts).toHaveBeenCalledTimes(1);
});

test('keeps closed assignments visible and read-only', async () => {
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(
        response({
          plan: {
            id: 3,
            rosterID: 2,
            status: 'closed',
            planningYear: 2026,
            openedAt: '2026-08-06T12:00:00.000Z',
            closedAt: '2026-08-06T13:00:00.000Z',
          },
          shifts: [shift],
        }),
      )}
    />,
  );

  expect(await screen.findByText('Plan closed')).toBeVisible();
  expect(screen.getByText('AM Chum Wench')).toBeVisible();
  expect(screen.getByText(/assignments are read-only/i)).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
