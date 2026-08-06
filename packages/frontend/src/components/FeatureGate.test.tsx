import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import FeatureGate from './FeatureGate';
import { FeatureFlagsState } from '../state/features';

function renderChorePlanningGate(chorePlanning: boolean) {
  return render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(FeatureFlagsState, { chorePlanning });
      }}
    >
      <FeatureGate feature="chorePlanning">
        <span>Chore planning</span>
      </FeatureGate>
    </RecoilRoot>,
  );
}

test('hides feature content while the backend flag is disabled', () => {
  renderChorePlanningGate(false);

  expect(screen.queryByText('Chore planning')).not.toBeInTheDocument();
});

test('shows feature content while the backend flag is enabled', () => {
  renderChorePlanningGate(true);

  expect(screen.getByText('Chore planning')).toBeInTheDocument();
});
