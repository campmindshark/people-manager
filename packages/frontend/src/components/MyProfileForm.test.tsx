import React from 'react';
import { render, screen } from '@testing-library/react';
import User from 'backend/models/user/user';
import { RecoilRoot } from 'recoil';

import { UserState } from '../state/store';
import MyProfileForm from './MyProfileForm';

test('renders when skills of note is null', () => {
  const user = new User();
  user.skillsOfNote = null as unknown as string[];

  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(UserState, user);
      }}
    >
      <MyProfileForm />
    </RecoilRoot>,
  );

  expect(screen.getByText('Edit Your Public Profile')).toBeInTheDocument();
});
