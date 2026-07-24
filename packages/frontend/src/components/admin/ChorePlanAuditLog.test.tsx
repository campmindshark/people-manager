import React from 'react';
import { render, screen } from '@testing-library/react';
import ChorePlanAuditEntry from 'backend/view_models/chore_plan_audit';
import ChorePlanAuditLog, { auditEntryDescription } from './ChorePlanAuditLog';

function auditEntry(
  overrides: Partial<ChorePlanAuditEntry> = {},
): ChorePlanAuditEntry {
  return {
    id: 1,
    chorePlanID: 2,
    actor: { id: 3, name: 'Leslie Knope' },
    action: 'signups_opened',
    details: {},
    createdAt: '2026-07-19T16:30:00.000Z',
    ...overrides,
  };
}

test('describes plan capacity changes', () => {
  expect(
    auditEntryDescription(
      auditEntry({
        action: 'plan_updated',
        details: {
          previousCamperCount: 40,
          camperCount: 50,
          addedSlots: 70,
          createdShifts: 4,
        },
      }),
    ),
  ).toBe(
    'Updated the chore plan: camper count 40 → 50, added 70 signup spots, created 4 shifts.',
  );
});

test('renders actor and audit description', () => {
  render(<ChorePlanAuditLog entries={[auditEntry()]} loading={false} />);

  expect(screen.getByText('Opened chore signups.')).toBeInTheDocument();
  expect(screen.getByText(/Leslie Knope/)).toBeInTheDocument();
  expect(
    screen.getByRole('region', { name: 'Change history entries' }),
  ).toHaveStyle({
    maxHeight: '400px',
    overflowY: 'auto',
  });
});

test('describes an admin shift unassignment', () => {
  expect(
    auditEntryDescription(
      auditEntry({
        action: 'shift_participant_unassigned',
        details: {
          unassignment: {
            userID: 7,
            userName: 'Ben Wyatt',
            sourceShift: {
              id: 34,
              scheduleName: 'Kitchen cleanup',
              startTime: '2026-08-23T15:00:00.000Z',
            },
          },
        },
      }),
    ),
  ).toBe('Unassigned Ben Wyatt from Kitchen cleanup.');
});

test('describes an admin shift assignment', () => {
  expect(
    auditEntryDescription(
      auditEntry({
        action: 'shift_participant_assigned',
        details: {
          assignment: {
            userID: 7,
            userName: 'Ben Wyatt',
            destinationShift: {
              id: 34,
              scheduleName: 'Kitchen cleanup',
              startTime: '2026-08-23T15:00:00.000Z',
            },
          },
        },
      }),
    ),
  ).toBe('Assigned Ben Wyatt to Kitchen cleanup.');
});

test('shows an empty state', () => {
  render(<ChorePlanAuditLog entries={[]} loading={false} />);

  expect(
    screen.getByText('No administrative changes have been recorded yet.'),
  ).toBeInTheDocument();
});
