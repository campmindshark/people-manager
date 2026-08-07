import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { FeatureFlagsState } from '../state/features';
import Shifts, { VerifiedShiftExperience } from './Shifts';

let mockLifecycleStatus = 'draft';
let mockShiftViewMountCount = 0;

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
  };
});

jest.mock('src/components/shifts/ChorePlanShiftView', () => {
  const ReactModule = jest.requireActual('react') as typeof import('react');

  function ChorePlanShiftView() {
    const [mountNumber] = ReactModule.useState(() => {
      mockShiftViewMountCount += 1;
      return mockShiftViewMountCount;
    });
    return (
      <div>
        <div>Chore signup sheets</div>
        <div>Chore sheet mount {mountNumber}</div>
      </div>
    );
  }
  return ChorePlanShiftView;
});
jest.mock('src/components/shifts/ShiftDisplay', () => () => (
  <div>Legacy hourly shifts</div>
));

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
    plan: { id: 3, status: mockLifecycleStatus },
    loading: false,
    error: null,
    reviewingReopen: false,
    setReviewingReopen: jest.fn(),
    toggleSignups: jest.fn(),
    reopenSignups: jest.fn(),
  }),
}));

beforeEach(() => {
  mockLifecycleStatus = 'draft';
  mockShiftViewMountCount = 0;
});

function renderExperience(chorePlanning: boolean) {
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(FeatureFlagsState, { chorePlanning });
      }}
    >
      <VerifiedShiftExperience rosterID={3} />
    </RecoilRoot>,
  );
}

test('replaces the legacy hourly grid with chore signup sheets when enabled', () => {
  renderExperience(true);

  expect(screen.getByText('Chore signup sheets')).toBeVisible();
  expect(screen.queryByText('Legacy hourly shifts')).not.toBeInTheDocument();
});

test('keeps the legacy hourly grid when chore planning is disabled', () => {
  renderExperience(false);

  expect(screen.getByText('Legacy hourly shifts')).toBeVisible();
  expect(screen.queryByText('Chore signup sheets')).not.toBeInTheDocument();
});

test('puts PR 58 lifecycle status and action before the signup sheets', () => {
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
  expect(
    screen.getByRole('button', { name: 'Open Chore Signups' }),
  ).toBeVisible();
  const status = screen.getByText('Chore signup status');
  const shifts = screen.getByText('Chore signup sheets');
  expect(status).toBeVisible();
  expect(shifts).toBeVisible();
  expect(status.compareDocumentPosition(shifts)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});

test('refreshes the signup sheets when lifecycle status changes', () => {
  const shiftsPage = () => (
    <RecoilRoot
      initializeState={({ set }) => {
        set(FeatureFlagsState, { chorePlanning: true });
      }}
    >
      <Shifts />
    </RecoilRoot>
  );
  const { rerender } = render(shiftsPage());

  expect(screen.getByText('Chore sheet mount 1')).toBeVisible();

  mockLifecycleStatus = 'open';
  rerender(shiftsPage());

  expect(screen.getByText('Chore sheet mount 2')).toBeVisible();
});
