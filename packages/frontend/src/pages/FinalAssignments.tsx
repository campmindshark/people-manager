import React, { useEffect } from 'react';
import { Alert, Box, Container, Stack, Typography } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import ShiftDisplay from '../components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import { CurrentRosterState } from '../state/roster';
import PageState, { CurrentUserIsVerified } from '../state/store';

export default function FinalAssignments() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const currentRoster = useRecoilValue(CurrentRosterState);

  useEffect(() => {
    setPageState({
      title: 'Final Assignments',
      index: 'final-assignments',
    });
  }, [setPageState]);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" gutterBottom variant="h3">
              {currentRoster.year} final assignments
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
              Review the closed camp schedule by date, or print a daily copy for
              use on playa.
            </Typography>
          </Box>
          {userIsVerified ? (
            <ShiftDisplay mode="final" />
          ) : (
            <Alert severity="info">
              Verify your account to view final assignments.
            </Alert>
          )}
        </Stack>
      </Container>
    </Dashboard>
  );
}
