import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot, RecoilState } from 'recoil';
import { FeatureFlagsState } from '../../state/features';
import { UserCanSignupForShifts } from '../../state/users';
import NavList from './NavList';

jest.mock('../../state/store', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    __esModule: true,
    default: atom({
      key: 'testNavigationPageState',
      default: { title: '', index: '' },
    }),
    MyRolesState: atom({
      key: 'testNavigationRolesState',
      default: [],
    }),
  };
});

jest.mock('../../state/users', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    UserCanSignupForShifts: atom({
      key: 'testNavigationShiftSignupAccess',
      default: false,
    }),
  };
});

function renderNavigation({
  chorePlanning,
  canSignupForShifts,
}: {
  chorePlanning: boolean;
  canSignupForShifts: boolean;
}) {
  render(
    <MemoryRouter>
      <RecoilRoot
        initializeState={({ set }) => {
          set(FeatureFlagsState, { chorePlanning });
          set(
            UserCanSignupForShifts as RecoilState<boolean>,
            canSignupForShifts,
          );
        }}
      >
        <NavList />
      </RecoilRoot>
    </MemoryRouter>,
  );
}

test('shows Shifts for chore planning without legacy shift signup access', () => {
  renderNavigation({ chorePlanning: true, canSignupForShifts: false });

  expect(screen.getByRole('link', { name: 'Shifts' })).toBeVisible();
});

test('hides legacy Shifts before the user signup window opens', () => {
  renderNavigation({ chorePlanning: false, canSignupForShifts: false });

  expect(
    screen.queryByRole('link', { name: 'Shifts' }),
  ).not.toBeInTheDocument();
});

test('shows legacy Shifts after the user signup window opens', () => {
  renderNavigation({ chorePlanning: false, canSignupForShifts: true });

  expect(screen.getByRole('link', { name: 'Shifts' })).toBeVisible();
});
