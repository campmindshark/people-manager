import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { FeatureFlagsState } from '../state/features';
import Shifts, { VerifiedShiftExperience } from './Shifts';

jest.mock('../layouts/dashboard/Dashboard', () => {
  function Dashboard({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }
  return Dashboard;
});

jest.mock('../state/roster', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    CurrentRosterState: atom({
      key: 'testCurrentRoster',
      default: { id: 2, year: 2026 },
    }),
  };
});

jest.mock('../state/store', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    __esModule: true,
    default: atom({
      key: 'testPageState',
      default: { title: '', index: '' },
    }),
    CurrentUserIsVerified: atom({
      key: 'testCurrentUserVerified',
      default: true,
    }),
    MyRolesState: atom({
      key: 'testMyRoles',
      default: [
        {
          permissions: ['chorePlans:assign', 'chorePlans:forceAssign'],
        },
      ],
    }),
  };
});

jest.mock('src/components/shifts/ChorePlanShiftView', () => {
  function ChorePlanShiftView({
    adminEditMode,
    canForceAssignments,
  }: {
    adminEditMode: boolean;
    canForceAssignments: boolean;
  }) {
    return (
      <div>
        Chore signup sheets — {adminEditMode ? 'admin' : 'member'} —{' '}
        {canForceAssignments ? 'force allowed' : 'safe edits only'}
      </div>
    );
  }
  return ChorePlanShiftView;
});
jest.mock('src/components/shifts/ShiftDisplay', () => {
  function ShiftDisplay() {
    return <div>Legacy hourly shifts</div>;
  }
  return ShiftDisplay;
});

jest.mock('src/components/shifts/ChoreSignupControls', () => ({
  __esModule: true,
  default: function ChoreSignupControls() {
    return <div>Chore signup status</div>;
  },
  ChoreSignupButton: function ChoreSignupButton() {
    return <button type="button">Open Chore Signups</button>;
  },
  ChoreSignupReopenDialog: function ChoreSignupReopenDialog() {
    return null;
  },
  useChoreSignupControls: () => ({
    canManageChorePlans: true,
    canReopenChorePlans: true,
    plan: { status: 'draft' },
    loading: false,
    error: null,
    success: null,
    reviewingReopen: false,
    setReviewingReopen: jest.fn(),
    toggleSignups: jest.fn(),
    reopenSignups: jest.fn(),
  }),
}));

function renderExperience(
  chorePlanning: boolean,
  adminEditMode = false,
  canForceAssignments = false,
) {
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(FeatureFlagsState, { chorePlanning });
      }}
    >
      <VerifiedShiftExperience
        adminEditMode={adminEditMode}
        canForceAssignments={canForceAssignments}
        rosterID={3}
      />
    </RecoilRoot>,
  );
}

test('replaces the legacy hourly grid with chore signup sheets when enabled', () => {
  renderExperience(true);

  expect(screen.getByText(/Chore signup sheets/)).toBeVisible();
  expect(screen.queryByText('Legacy hourly shifts')).not.toBeInTheDocument();
});

test('keeps the legacy hourly grid when chore planning is disabled', () => {
  renderExperience(false);

  expect(screen.getByText('Legacy hourly shifts')).toBeVisible();
  expect(screen.queryByText('Chore signup sheets')).not.toBeInTheDocument();
});

test('forwards PR 58 admin edit mode and force permission to the signup sheets', () => {
  renderExperience(true, true, true);

  expect(
    screen.getByText(/Chore signup sheets — admin — force allowed/),
  ).toBeVisible();
});

test('keeps PR 58 lifecycle and Admin Edit controls above signup sheets', () => {
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(FeatureFlagsState, { chorePlanning: true });
      }}
    >
      <Shifts />
    </RecoilRoot>,
  );

  expect(
    screen.getByRole('heading', { name: '2026 shift signup' }),
  ).toBeVisible();
  const lifecycleButton = screen.getByRole('button', {
    name: 'Open Chore Signups',
  });
  const adminEditButton = screen.getByRole('button', { name: 'Admin Edit' });
  const status = screen.getByText('Chore signup status');
  const shifts = screen.getByText(/Chore signup sheets — member/);
  expect(lifecycleButton).toBeVisible();
  expect(adminEditButton).toBeVisible();
  expect(status).toBeVisible();
  expect(shifts).toBeVisible();
  expect(lifecycleButton.compareDocumentPosition(adminEditButton)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(status.compareDocumentPosition(shifts)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});
