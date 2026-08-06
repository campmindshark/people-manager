import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import FeatureGate from 'src/components/FeatureGate';
import ChorePlanShiftView from 'src/components/shifts/ChorePlanShiftView';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import { ActiveRosterIDState } from '../state/roster';
import PageState, { CurrentUserIsVerified } from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const activeRosterID = useRecoilValue(ActiveRosterIDState);

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
          <Stack spacing={4}>
            <FeatureGate feature="chorePlanning">
              <ChorePlanShiftView rosterID={activeRosterID} />
            </FeatureGate>
            <ShiftDisplay />
          </Stack>
        ) : (
          <h1>Verify your account to sign up for shifts.</h1>
        )}
      </Container>
    </Dashboard>
  );
}
