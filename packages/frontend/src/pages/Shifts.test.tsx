import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import Shifts from './Shifts';

jest.mock('../layouts/dashboard/Dashboard', () => {
  function Dashboard({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }
  return Dashboard;
});

jest.mock('../state/features', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    FeatureFlagsState: atom({
      key: 'testFeatureFlags',
      default: { chorePlanning: true },
    }),
  };
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

jest.mock('src/components/shifts/ShiftDisplay', () => {
  function ShiftDisplay() {
    return <div>Shift display</div>;
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

test('puts PR 58 lifecycle status and action on the Shifts page', () => {
  render(
    <RecoilRoot>
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
  const shifts = screen.getByText('Shift display');
  expect(status).toBeVisible();
  expect(shifts).toBeVisible();
  expect(status.compareDocumentPosition(shifts)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});
