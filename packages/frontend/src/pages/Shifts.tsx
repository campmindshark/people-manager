import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, { CurrentUserIsVerified } from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  }, [PageState]);

  return (
    <Dashboard>
      <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
        {userIsVerified ? (
          <ShiftDisplay />
        ) : (
          <h1>Verify your account to sign up for shifts.</h1>
        )}
      </Container>
    </Dashboard>
  );
}
