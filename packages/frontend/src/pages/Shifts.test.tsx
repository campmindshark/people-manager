import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { FeatureFlagsState } from '../state/features';
import { VerifiedShiftExperience } from './Shifts';

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
