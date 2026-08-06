import React, { useEffect } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import FeatureGate from 'src/components/FeatureGate';
import ChorePlanShiftView from 'src/components/shifts/ChorePlanShiftView';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import { CurrentRosterState } from '../state/roster';
import PageState, { CurrentUserIsVerified } from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const currentRoster = useRecoilValue(CurrentRosterState);

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  }, [setPageState]);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              {currentRoster.year} shift signup
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
              Browse the chore, event, and dinner sheets generated from this
              year&apos;s chore plan.
            </Typography>
          </Box>
          {userIsVerified ? (
            <Stack spacing={4}>
              <FeatureGate feature="chorePlanning">
                <ChorePlanShiftView rosterID={currentRoster.id} />
              </FeatureGate>
              <ShiftDisplay />
            </Stack>
          ) : (
            <Alert severity="info">
              Verify your account to view the shift signup sheets.
            </Alert>
          )}
        </Stack>
      </Container>
    </Dashboard>
  );
}
