import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES,
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
  requiredParticipants: 1,
  assignedParticipantCount: 1,
  currentUserAssigned: true,
  signupRestrictionReason: null,
  signupConflictShiftIDs: [],
  signupConflicts: [],
  assignments: [{ displayName: 'Moonbeam', currentUser: true }],
  slots: [
    {
      definitionKey: 'chore-am-chum-wench-first',
      positionLabel: 'First',
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
  requirements = { chore: 1, event: 1, dinner: 1 },
): ChorePlanShiftViewResponse {
  return response({
    plan: {
      id: 3,
      rosterID: 2,
      status: 'open',
      planningYear: 2026,
      requirements,
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
            requirements: { chore: 1, event: 1, dinner: 1 },
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

test('renders PR 58-style signup sheets and category requirements', async () => {
  const eventShift = {
    ...shift,
    id: 12,
    stableKey: 'event|1|gate',
    scheduleKey: 'event|gate',
    kind: 'event' as const,
    scheduleName: 'Gate',
    timePeriodLabel: '6p-9p',
    periodOrder: 1,
    currentUserAssigned: false,
    assignments: [{ displayName: 'Alex R.', currentUser: false }],
  };
  const dinnerShift = {
    ...shift,
    id: 13,
    stableKey: 'dinner|1|kitchen',
    scheduleKey: 'dinner|kitchen',
    kind: 'dinner' as const,
    scheduleName: 'Kitchen Dinner',
    currentUserAssigned: false,
    assignments: [{ displayName: 'Taylor B.', currentUser: false }],
  };
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(openResponse([shift, eventShift, dinnerShift]))}
    />,
  );

  expect(await screen.findByText('AM Chum Wench')).toBeVisible();
  expect(screen.getByText('Moonbeam')).toBeVisible();
  expect(screen.getByText('Requirement complete!')).toBeVisible();
  expect(screen.getAllByText('1 shift required!')).toHaveLength(2);

  userEvent.click(screen.getByRole('button', { name: /event crew/i }));
  expect(screen.getAllByText('Gate')).toHaveLength(7);
  expect(screen.getByText('Alex R.')).toBeVisible();
  userEvent.click(screen.getByRole('button', { name: /dinner crew/i }));
  expect(screen.getByText('Kitchen Dinner')).toBeVisible();
  expect(screen.getByText('Taylor B.')).toBeVisible();
});

test('lets any open spot select the next available position', async () => {
  const threeSlotShift = {
    ...shift,
    assignedParticipantCount: 0,
    currentUserAssigned: false,
    requiredParticipants: 3,
    assignments: [],
    slots: [
      ...shift.slots,
      { definitionKey: 'chore-am-chum-wench-second', positionLabel: 'Second' },
      { definitionKey: 'chore-am-chum-wench-third', positionLabel: 'Third' },
    ],
  };
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(openResponse([threeSlotShift]))}
    />,
  );

  const openSpots = await screen.findAllByRole('button', {
    name: /select open spot for AM Chum Wench/i,
  });
  expect(openSpots).toHaveLength(3);
  openSpots.forEach((openSpot) => expect(openSpot).toBeEnabled());

  userEvent.click(openSpots[2]);

  expect(
    screen.getByRole('button', {
      name: /deselect open spot for AM Chum Wench/i,
    }),
  ).toHaveTextContent('Selected');
  screen
    .getAllByRole('button', {
      name: /^select open spot for AM Chum Wench/i,
    })
    .forEach((openSpot) => expect(openSpot).toBeDisabled());
});

test('selects and submits as many as three non-conflicting chores at once', async () => {
  const dates = [
    ['2026-08-30T18:00:00.000Z', '2026-08-30T19:00:00.000Z'],
    ['2026-08-31T18:00:00.000Z', '2026-08-31T19:00:00.000Z'],
    ['2026-09-01T18:00:00.000Z', '2026-09-01T19:00:00.000Z'],
    ['2026-09-02T18:00:00.000Z', '2026-09-02T19:00:00.000Z'],
  ];
  const shifts = dates.map(([startTime, endTime], index) => ({
    ...shift,
    id: 11 + index,
    stableKey: `chore|${index + 1}|job-${index + 1}`,
    scheduleKey: `chore|job-${index + 1}`,
    scheduleName: `Daily job ${index + 1}`,
    displayDayNumber: index + 1,
    startTime,
    endTime,
    assignedParticipantCount: 0,
    currentUserAssigned: false,
    assignments: [],
  }));
  const planClient = client(
    openResponse(shifts, { chore: 4, event: 1, dinner: 1 }),
  );
  render(<ChorePlanShiftView rosterID={2} planClient={planClient} />);

  const openSpot = (job: number) =>
    screen.getByRole('button', {
      name: new RegExp(`select open spot for Daily job ${job}`, 'i'),
    });
  userEvent.click(
    await screen.findByRole('button', {
      name: /select open spot for Daily job 1/i,
    }),
  );
  expect(openSpot(2)).toBeEnabled();
  userEvent.click(openSpot(2));
  expect(openSpot(3)).toBeEnabled();
  userEvent.click(openSpot(3));
  expect(openSpot(4)).toBeDisabled();

  userEvent.click(screen.getByRole('button', { name: 'Sign up (3)' }));
  await waitFor(() =>
    expect(planClient.Signup).toHaveBeenCalledWith(2, {
      shiftIDs: [11, 12, 13],
    }),
  );
  expect(
    await screen.findByText(/signed up for 3 chore shifts/i),
  ).toBeVisible();
});

test('selects signup-sheet slots before signup, removal, and switching', async () => {
  const openShift = {
    ...shift,
    id: 12,
    stableKey: 'chore|1|am-ice-bitch',
    scheduleKey: 'chore|am-ice-bitch',
    scheduleName: 'AM Ice Bitch',
    assignedParticipantCount: 0,
    currentUserAssigned: false,
    assignments: [],
  };

  const signupClient = client(
    openResponse([
      {
        ...shift,
        assignedParticipantCount: 0,
        currentUserAssigned: false,
        assignments: [],
      },
    ]),
  );
  const onParticipantStatusChanged = jest.fn();
  const signupRender = render(
    <ChorePlanShiftView
      onParticipantStatusChanged={onParticipantStatusChanged}
      rosterID={2}
      planClient={signupClient}
    />,
  );
  userEvent.click(
    await screen.findByRole('button', {
      name: /select open spot for AM Chum Wench/i,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Sign up (1)' }));
  await waitFor(() =>
    expect(signupClient.Signup).toHaveBeenCalledWith(2, { shiftIDs: [11] }),
  );
  expect(await screen.findByText(/signed up for 1 chore shift/i)).toBeVisible();
  expect(signupClient.GetShifts).toHaveBeenCalledTimes(2);
  expect(onParticipantStatusChanged).toHaveBeenCalledTimes(1);
  signupRender.unmount();

  const removeClient = client(openResponse([shift]));
  const removeRender = render(
    <ChorePlanShiftView rosterID={2} planClient={removeClient} />,
  );
  userEvent.click(
    await screen.findByRole('button', {
      name: /remove your spot for AM Chum Wench/i,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Remove shift' }));
  await waitFor(() => expect(removeClient.Remove).toHaveBeenCalledWith(2, 11));
  expect(await screen.findByText(/removed AM Chum Wench/i)).toBeVisible();
  removeRender.unmount();

  const switchClient = client(openResponse([shift, openShift]));
  render(<ChorePlanShiftView rosterID={2} planClient={switchClient} />);
  userEvent.click(
    await screen.findByRole('button', {
      name: /remove your spot for AM Chum Wench/i,
    }),
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /select open spot for AM Ice Bitch/i,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Change shift' }));
  await waitFor(() =>
    expect(switchClient.Switch).toHaveBeenCalledWith(2, {
      fromShiftID: 11,
      toShiftID: 12,
    }),
  );
  expect(await screen.findByText(/changed to AM Ice Bitch/i)).toBeVisible();
});

test.each([
  [
    'the attendance window',
    CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.outsideAttendanceWindow,
  ],
  [
    'an existing assignment',
    CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict,
  ],
])('disables and explains spots blocked by %s', async (_label, reason) => {
  const restrictedShift = {
    ...shift,
    assignedParticipantCount: 0,
    currentUserAssigned: false,
    assignments: [],
    signupRestrictionReason: reason,
    signupConflictShiftIDs:
      reason === CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict
        ? [99]
        : [],
    signupConflicts:
      reason === CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict
        ? [
            {
              shiftID: 99,
              scheduleName: 'Kitchen prep',
              startTime: '2026-08-30T18:30:00.000Z',
              endTime: '2026-08-30T19:30:00.000Z',
            },
          ]
        : [],
  };
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(openResponse([restrictedShift]))}
    />,
  );

  const openSpot = await screen.findByRole('button', {
    name: /select open spot for AM Chum Wench/i,
  });
  expect(openSpot).toBeDisabled();

  fireEvent.mouseOver(openSpot.parentElement as HTMLElement);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent(reason);
  if (reason === CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict) {
    expect(tooltip).toHaveTextContent(
      'Conflicting assignment: Kitchen prep (11:30 AM to 12:30 PM).',
    );
  }
});

test('enables an overlapping replacement only when its conflict is selected for removal', async () => {
  const replacementShift = {
    ...shift,
    id: 12,
    stableKey: 'chore|1|am-ice-bitch',
    scheduleKey: 'chore|am-ice-bitch',
    scheduleName: 'AM Ice Bitch',
    assignedParticipantCount: 0,
    currentUserAssigned: false,
    assignments: [],
    signupRestrictionReason:
      CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict,
    signupConflictShiftIDs: [shift.id],
    signupConflicts: [
      {
        shiftID: shift.id,
        scheduleName: shift.scheduleName,
        startTime: shift.startTime,
        endTime: shift.endTime,
      },
    ],
  };
  render(
    <ChorePlanShiftView
      rosterID={2}
      planClient={client(openResponse([shift, replacementShift]))}
    />,
  );

  const replacementSpot = await screen.findByRole('button', {
    name: /select open spot for AM Ice Bitch/i,
  });
  expect(replacementSpot).toBeDisabled();

  userEvent.click(
    screen.getByRole('button', {
      name: /remove your spot for AM Chum Wench/i,
    }),
  );
  expect(replacementSpot).toBeEnabled();
});

test('shows authoritative backend signup conflicts', async () => {
  const planClient = client(
    openResponse([
      {
        ...shift,
        assignedParticipantCount: 0,
        currentUserAssigned: false,
        assignments: [],
      },
    ]),
  );
  planClient.Signup = jest.fn().mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'This chore plan shift is full.' },
    },
  });
  render(<ChorePlanShiftView rosterID={2} planClient={planClient} />);

  userEvent.click(
    await screen.findByRole('button', {
      name: /select open spot for AM Chum Wench/i,
    }),
  );
  userEvent.click(screen.getByRole('button', { name: 'Sign up (1)' }));
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
            requirements: { chore: 1, event: 1, dinner: 1 },
            openedAt: '2026-08-06T12:00:00.000Z',
            closedAt: '2026-08-06T13:00:00.000Z',
          },
          shifts: [shift],
        }),
      )}
    />,
  );

  expect(await screen.findByText('AM Chum Wench')).toBeVisible();
  expect(screen.getAllByText('Signups closed')).toHaveLength(3);
  expect(
    screen.queryByRole('button', { name: /select|remove|sign up/i }),
  ).not.toBeInTheDocument();
});
