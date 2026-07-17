import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Shift from 'backend/models/shift/shift';
import User from 'backend/models/user/user';
import { ChorePlanKind } from 'backend/view_models/chore_plan';
import { DateTime } from 'luxon';
import FinalAssignmentsView, {
  assignmentDays,
  assignmentsAreFinal,
  assignmentTime,
  FinalAssignmentShift,
} from './FinalAssignmentsView';

function assignmentShift({
  id,
  kind = 'chore',
  name,
  start,
  end,
  participants = [],
  requiredParticipants = 1,
  status = 'closed',
}: {
  id: number;
  kind?: ChorePlanKind;
  name: string;
  start: string;
  end: string;
  participants?: User[];
  requiredParticipants?: number;
  status?: 'draft' | 'open' | 'closed';
}): FinalAssignmentShift {
  return {
    key: String(id),
    kind,
    scheduleName: name,
    day:
      (DateTime.fromISO(start, { zone: 'utc' }).setZone('America/Los_Angeles')
        .weekday %
        7) +
      1,
    timePeriod: DateTime.fromISO(start, { zone: 'utc' })
      .setZone('America/Los_Angeles')
      .toFormat('h:mm a'),
    periodOrder: 0,
    shiftViewModel: {
      shift: new Shift(
        id,
        4,
        new Date(start),
        new Date(end),
        requiredParticipants,
      ),
      scheduleName: name,
      participants,
      signupOpen: status === 'open',
      chorePlanStatus: status,
    },
  };
}

test('groups and sorts assignments by their actual Pacific calendar date', () => {
  const days = assignmentDays([
    assignmentShift({
      id: 2,
      name: 'After-midnight patrol',
      start: '2026-08-24T08:00:00.000Z',
      end: '2026-08-24T09:00:00.000Z',
    }),
    assignmentShift({
      id: 1,
      name: 'Late kitchen cleanup',
      start: '2026-08-24T06:00:00.000Z',
      end: '2026-08-24T07:00:00.000Z',
    }),
  ]);

  expect(days.map(({ key }) => key)).toEqual(['2026-08-23', '2026-08-24']);
  expect(days.map(({ weekday }) => weekday)).toEqual(['Sunday', 'Monday']);
});

test('orders same-day assignments by start time', () => {
  const days = assignmentDays([
    assignmentShift({
      id: 2,
      name: 'Dinner',
      start: '2026-08-24T01:00:00.000Z',
      end: '2026-08-24T02:00:00.000Z',
    }),
    assignmentShift({
      id: 1,
      name: 'Lunch',
      start: '2026-08-23T19:00:00.000Z',
      end: '2026-08-23T20:00:00.000Z',
    }),
  ]);

  expect(days[0].shifts.map(({ scheduleName }) => scheduleName)).toEqual([
    'Lunch',
    'Dinner',
  ]);
});

test('only treats a completely closed plan as final', () => {
  const closedShift = assignmentShift({
    id: 1,
    name: 'Kitchen',
    start: '2026-08-23T15:00:00.000Z',
    end: '2026-08-23T16:00:00.000Z',
  });
  const openShift = assignmentShift({
    id: 2,
    name: 'Gate',
    start: '2026-08-23T16:00:00.000Z',
    end: '2026-08-23T17:00:00.000Z',
    status: 'open',
  });

  expect(assignmentsAreFinal([closedShift])).toBe(true);
  expect(assignmentsAreFinal([closedShift, openShift])).toBe(false);
  expect(assignmentsAreFinal([])).toBe(false);
});

test('labels an assignment that ends on the next calendar day', () => {
  const shift = assignmentShift({
    id: 1,
    name: 'Late patrol',
    start: '2026-08-24T06:00:00.000Z',
    end: '2026-08-24T08:00:00.000Z',
  });

  expect(assignmentTime(shift)).toBe('11:00 PM–1:00 AM next day');
});

test('renders only participant names, highlights the current user, and prints', () => {
  const currentUser = User.fromJson({
    id: 7,
    firstName: 'Leslie',
    lastName: 'Knope',
    playaName: 'Waffles',
  });
  const otherUser = User.fromJson({
    id: 8,
    firstName: 'Ben',
    lastName: 'Wyatt',
  });
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  const shift = assignmentShift({
    id: 1,
    kind: 'dinner',
    name: 'Dinner prep',
    start: '2026-08-23T23:30:00.000Z',
    end: '2026-08-24T00:30:00.000Z',
    participants: [otherUser, currentUser],
    requiredParticipants: 3,
  });

  render(
    <FinalAssignmentsView
      currentUserID={currentUser.id}
      rosterYear={2026}
      shifts={[shift]}
    />,
  );

  expect(screen.getByText('Waffles (Leslie K.)')).toHaveClass('current-user');
  expect(screen.getByText('(you)')).toHaveClass(
    'final-assignment-current-user-label',
  );
  expect(screen.getByText('Ben W.')).toBeInTheDocument();
  expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+ assigned$/i)).not.toBeInTheDocument();
  expect(screen.getByText('2026 final assignments')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Dinner crew' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
  expect(screen.getByText('Sunday')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Print assignments' }));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});

test('leaves the table cell blank when a shift has no participants', () => {
  const shift = assignmentShift({
    id: 1,
    name: 'Kitchen cleanup',
    start: '2026-08-23T23:30:00.000Z',
    end: '2026-08-24T00:30:00.000Z',
    requiredParticipants: 3,
  });

  render(
    <FinalAssignmentsView
      currentUserID={7}
      rosterYear={2026}
      shifts={[shift]}
    />,
  );

  const sundayRow = screen.getByRole('row', { name: /Sunday/ });
  expect(within(sundayRow).getByRole('cell')).toBeEmptyDOMElement();
  expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
});
