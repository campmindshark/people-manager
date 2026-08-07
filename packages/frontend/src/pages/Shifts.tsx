import React, { useEffect } from 'react';
import { Alert, Box, Container, Stack, Typography } from '@mui/material';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import ChoreSignupControls, {
  ChoreSignupButton,
  ChoreSignupReopenDialog,
  useChoreSignupControls,
} from 'src/components/shifts/ChoreSignupControls';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import { FeatureFlagsState } from '../state/features';
import { CurrentRosterState } from '../state/roster';
import PageState, { CurrentUserIsVerified } from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const featureFlags = useRecoilValue(FeatureFlagsState);
  const {
    canManageChorePlans,
    canReopenChorePlans,
    plan: chorePlan,
    loading: choreSignupLoading,
    error: choreSignupError,
    success: choreSignupSuccess,
    reviewingReopen,
    setReviewingReopen,
    toggleSignups,
    reopenSignups,
  } = useChoreSignupControls();

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  }, [setPageState]);

  if (!featureFlags.chorePlanning) {
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

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          <Stack
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h3" component="h1" gutterBottom>
                {currentRoster.year} shift signup
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
                Browse the chore, event, and dinner sheets generated from this
                year&apos;s chore plan.
              </Typography>
            </Box>
            {canManageChorePlans && (
              <ChoreSignupButton
                canReopen={canReopenChorePlans}
                loading={choreSignupLoading}
                onReviewReopen={() => setReviewingReopen(true)}
                onToggleSignups={toggleSignups}
                plan={chorePlan}
              />
            )}
          </Stack>
          <ChoreSignupControls
            canManageChorePlans={canManageChorePlans}
            error={choreSignupError}
            loading={choreSignupLoading}
            plan={chorePlan}
            rosterYear={currentRoster.year}
            success={choreSignupSuccess}
          />
          {userIsVerified ? (
            <ShiftDisplay />
          ) : (
            <Alert severity="info">
              Verify your account to view the shift signup sheets.
            </Alert>
          )}
        </Stack>
        <ChoreSignupReopenDialog
          loading={choreSignupLoading}
          onClose={() => setReviewingReopen(false)}
          onReopen={reopenSignups}
          open={reviewingReopen}
        />
      </Container>
    </Dashboard>
  );
}
