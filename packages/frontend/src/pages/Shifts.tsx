import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import ChoreSignupControls, {
  ChoreSignupButton,
  useChoreSignupControls,
} from '../components/shifts/ChoreSignupControls';
import Dashboard from '../layouts/dashboard/Dashboard';
import { CurrentRosterState } from '../state/roster';
import PageState, { CurrentUserIsVerified, MyRolesState } from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const roles = useRecoilValue(MyRolesState);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const {
    canManageChorePlans,
    plan: chorePlan,
    loading: choreSignupLoading,
    error: choreSignupError,
    toggleSignups,
  } = useChoreSignupControls();
  const canReassignShifts = roles.some((role) =>
    role.permissions.includes('shifts:swap'),
  );

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  }, [setPageState]);

  useEffect(() => {
    if (!canReassignShifts) {
      setAdminEditMode(false);
    }
  }, [canReassignShifts]);

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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {canManageChorePlans && (
                <ChoreSignupButton
                  loading={choreSignupLoading}
                  onToggleSignups={toggleSignups}
                  plan={chorePlan}
                />
              )}
              {canReassignShifts && userIsVerified && (
                <Button
                  color={adminEditMode ? 'secondary' : 'primary'}
                  onClick={() => setAdminEditMode((enabled) => !enabled)}
                  variant={adminEditMode ? 'contained' : 'outlined'}
                >
                  {adminEditMode ? 'Exit Admin Edit' : 'Admin Edit'}
                </Button>
              )}
            </Stack>
          </Stack>
          <ChoreSignupControls
            canManageChorePlans={canManageChorePlans}
            error={choreSignupError}
            loading={choreSignupLoading}
            plan={chorePlan}
            rosterYear={currentRoster.year}
          />
          {userIsVerified ? (
            <ShiftDisplay adminEditMode={adminEditMode} />
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
