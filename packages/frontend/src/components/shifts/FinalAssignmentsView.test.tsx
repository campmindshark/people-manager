import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChorePlanFinalAssignmentsResponse } from 'backend/view_models/chore_plan_final_assignments';
import FinalAssignmentsView from './FinalAssignmentsView';

function fixture(assignmentCount = 2): ChorePlanFinalAssignmentsResponse {
  return {
    rosterID: 2,
    planID: 10,
    status: 'closed',
    planningYear: 2026,
    closedAt: '2026-08-30T12:00:00.000Z',
    assignmentCount,
    categories: [
      {
        kind: 'chore',
        shifts: [
          {
            id: 101,
            stableKey: 'chore-sunday-breakfast',
            kind: 'chore',
            scheduleName: 'Breakfast cleanup',
            displayDayNumber: 1,
            displayDayLabel: 'Sunday',
            calendarDay: 23,
            timePeriodLabel: '9:00 AM',
            periodOrder: null,
            startTime: '2026-08-23T16:00:00.000Z',
            endTime: '2026-08-23T17:00:00.000Z',
            requiredParticipants: 3,
            participants:
              assignmentCount === 0
                ? []
                : [
                    {
                      displayName: 'Alpha (Amy Y.)',
                      currentUser: false,
                    },
                    {
                      displayName: 'Bravo (Zoe Z.)',
                      currentUser: true,
                    },
                  ],
          },
        ],
      },
      { kind: 'event', shifts: [] },
      { kind: 'dinner', shifts: [] },
    ],
  };
}

test('renders fixed category sheets, participant names, current user, and print control', () => {
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  render(<FinalAssignmentsView assignments={fixture()} />);

  expect(
    screen.getByRole('heading', { name: '2026 final assignments' }),
  ).toBeInTheDocument();
  const categoryHeadings = screen
    .getAllByRole('heading', { level: 2 })
    .map(({ textContent }) => textContent);
  expect(categoryHeadings).toEqual([
    'Daily chores',
    'Event crew',
    'Dinner crew',
  ]);
  expect(screen.getByText('Alpha (Amy Y.)')).toBeInTheDocument();
  expect(screen.getByText('Bravo (Zoe Z.)')).toHaveClass('current-user');
  expect(screen.getByText('(you)')).toHaveClass(
    'final-assignment-current-user-label',
  );
  expect(screen.getByText('Sunday')).toBeInTheDocument();
  expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
  expect(screen.getByText('No event crew were generated.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Print assignments' }));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});

test('keeps generated shifts visible when the closed plan has no assignments', () => {
  render(<FinalAssignmentsView assignments={fixture(0)} />);

  expect(
    screen.getByText(
      'No participant assignments were recorded when the plan closed.',
    ),
  ).toBeInTheDocument();
  const sundayRow = screen.getByRole('row', { name: /Sunday/ });
  expect(within(sundayRow).getByRole('cell')).toBeEmptyDOMElement();
  expect(screen.getByText('0 assignments')).toBeInTheDocument();
});
