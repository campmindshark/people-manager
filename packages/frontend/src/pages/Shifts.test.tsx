import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { FeatureFlagsState } from '../state/features';
import { VerifiedShiftExperience } from './Shifts';

jest.mock('src/components/shifts/ChorePlanShiftView', () => () => (
  <div>Chore signup sheets</div>
));
jest.mock('src/components/shifts/ShiftDisplay', () => () => (
  <div>Legacy hourly shifts</div>
));

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
