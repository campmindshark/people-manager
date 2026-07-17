import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { ChorePlanSummary } from 'backend/view_models/chore_plan';
import { useRecoilRefresher_UNSTABLE, useRecoilValue } from 'recoil';
import BackendChorePlanClient from '../../api/chorePlans/client';
import { getFrontendConfig } from '../../config/config';
import { CurrentRosterState } from '../../state/roster';
import CurrentRosterScheduleState from '../../state/schedules';
import { MyRolesState } from '../../state/store';

const frontendConfig = getFrontendConfig();

function requestErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

interface ChoreSignupControlState {
  canManageChorePlans: boolean;
  plan: ChorePlanSummary | null;
  loading: boolean;
  error: string | null;
  toggleSignups: () => Promise<void>;
}

export function useChoreSignupControls(): ChoreSignupControlState {
  const currentRoster = useRecoilValue(CurrentRosterState);
  const roles = useRecoilValue(MyRolesState);
  const refreshSchedules = useRecoilRefresher_UNSTABLE(
    CurrentRosterScheduleState,
  );
  const chorePlanClient = useMemo(
    () => new BackendChorePlanClient(frontendConfig.BackendURL),
    [],
  );
  const canManageChorePlans = roles.some((role) =>
    role.permissions.includes('chorePlans:manage'),
  );
  const [plan, setPlan] = useState<ChorePlanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageChorePlans) {
      setPlan(null);
      return undefined;
    }

    let active = true;
    setPlan(null);
    setLoading(true);
    setError(null);
    chorePlanClient
      .GetPlan(currentRoster.id)
      .then((loadedPlan) => {
        if (active) {
          setPlan(loadedPlan);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(requestErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canManageChorePlans, chorePlanClient, currentRoster.id]);

  const toggleSignups = async () => {
    if (!plan) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedPlan =
        plan.status === 'open'
          ? await chorePlanClient.CloseSignups(currentRoster.id)
          : await chorePlanClient.OpenSignups(currentRoster.id);
      setPlan(updatedPlan);
      refreshSchedules();
    } catch (toggleError) {
      setError(requestErrorMessage(toggleError));
    } finally {
      setLoading(false);
    }
  };

  return { canManageChorePlans, plan, loading, error, toggleSignups };
}

interface ChoreSignupButtonProps {
  plan: ChorePlanSummary | null;
  loading: boolean;
  onToggleSignups: () => void;
}

export function ChoreSignupButton({
  plan,
  loading,
  onToggleSignups,
}: ChoreSignupButtonProps) {
  if (!plan) {
    return null;
  }
  const signupsAreOpen = plan.status === 'open';
  let buttonLabel = signupsAreOpen
    ? 'Close Chore Signups'
    : 'Open Chore Signups';
  if (loading) {
    buttonLabel = signupsAreOpen ? 'Closing…' : 'Opening…';
  }

  return (
    <Button
      color={signupsAreOpen ? 'warning' : 'success'}
      disabled={loading}
      onClick={onToggleSignups}
      variant="outlined"
    >
      {buttonLabel}
    </Button>
  );
}

interface ChoreSignupControlsProps {
  canManageChorePlans: boolean;
  plan: ChorePlanSummary | null;
  loading: boolean;
  error: string | null;
  rosterYear: number;
}

export default function ChoreSignupControls({
  canManageChorePlans,
  plan,
  loading,
  error,
  rosterYear,
}: ChoreSignupControlsProps) {
  if (!canManageChorePlans) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && !plan && (
        <Alert severity="info" icon={<CircularProgress size={20} />}>
          Loading chore signup status…
        </Alert>
      )}
      {plan?.status === 'open' ? (
        <Alert severity="success">
          Chore signups are open for {rosterYear}.
        </Alert>
      ) : (
        plan && (
          <Alert severity={plan.status === 'closed' ? 'info' : 'warning'}>
            {plan.status === 'closed'
              ? `The ${rosterYear} chore plan is closed. Reopen signups to allow changes.`
              : 'The chore plan is visible below, but signups have not opened yet.'}
          </Alert>
        )
      )}
    </Stack>
  );
}
