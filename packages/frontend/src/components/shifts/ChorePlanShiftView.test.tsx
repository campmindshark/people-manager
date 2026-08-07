import React from 'react';
import { render, screen } from '@testing-library/react';
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
  return { GetShifts: jest.fn().mockResolvedValue(result) };
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

test('renders open generated shifts without mutation controls', async () => {
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
      planClient={client(
        response({
          plan: {
            id: 3,
            rosterID: 2,
            status: 'open',
            planningYear: 2026,
            requirements: { chore: 1, event: 1, dinner: 1 },
            openedAt: '2026-08-06T12:00:00.000Z',
            closedAt: null,
          },
          selfServiceMutationsAllowed: true,
          shifts: [shift, eventShift, dinnerShift],
        }),
      )}
    />,
  );

  expect(await screen.findByText('AM Chum Wench')).toBeVisible();
  expect(screen.getByText('Your signup')).toBeVisible();
  expect(screen.getByText('Requirement complete!')).toBeVisible();
  expect(screen.getAllByText('1 shift required!')).toHaveLength(2);
  expect(screen.getAllByText('Open spot')).toHaveLength(3);

  userEvent.click(screen.getByRole('button', { name: /event crew/i }));
  expect(screen.getAllByText('Gate')).toHaveLength(7);
  userEvent.click(screen.getByRole('button', { name: /dinner crew/i }));
  expect(screen.getByText('Kitchen Dinner')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /select|remove|sign up/i }),
  ).not.toBeInTheDocument();
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
