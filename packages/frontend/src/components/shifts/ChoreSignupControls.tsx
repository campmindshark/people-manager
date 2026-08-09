import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { ChorePlanLifecycleState } from 'backend/view_models/chore_plan_lifecycle';
import { useRecoilValue } from 'recoil';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';
import { FeatureFlagsState } from '../../state/features';
import { CurrentRosterState } from '../../state/roster';
import { MyRolesState } from '../../state/store';

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);

export interface ChoreSignupLifecycleClient {
  GetLifecycle: (
    rosterID: number,
  ) => Promise<{ plan: ChorePlanLifecycleState | null }>;
  Open: (rosterID: number) => Promise<ChorePlanLifecycleState>;
  Close: (rosterID: number) => Promise<ChorePlanLifecycleState>;
  Reopen: (
    rosterID: number,
    reason: string,
  ) => Promise<ChorePlanLifecycleState>;
}

interface ChoreSignupControlState {
  canManageChorePlans: boolean;
  canReopenChorePlans: boolean;
  plan: ChorePlanLifecycleState | null;
  loading: boolean;
  error: string | null;
  reviewingReopen: boolean;
  setReviewingReopen: (reviewing: boolean) => void;
  toggleSignups: () => Promise<void>;
  reopenSignups: (reason: string) => Promise<void>;
}

interface ChoreSignupLifecycleOptions {
  rosterID: number;
  canManageChorePlans: boolean;
  canReopenChorePlans: boolean;
  planClient: ChoreSignupLifecycleClient;
}

function requestErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const { response } = error as {
      response?: { data?: { error?: string }; status?: number };
    };
    if (response?.data?.error) {
      return response.data.error;
    }
    if (response?.status === 403) {
      return 'You do not have permission to manage chore signups.';
    }
  }
  return 'Could not update chore signups. Please try again.';
}

export function useChoreSignupLifecycle({
  rosterID,
  canManageChorePlans,
  canReopenChorePlans,
  planClient,
}: ChoreSignupLifecycleOptions): ChoreSignupControlState {
  const [plan, setPlan] = useState<ChorePlanLifecycleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewingReopen, setReviewingReopen] = useState(false);

  useEffect(() => {
    if (!canManageChorePlans) {
      setPlan(null);
      setError(null);
      setReviewingReopen(false);
      return undefined;
    }

    let active = true;
    setPlan(null);
    setLoading(true);
    setError(null);
    planClient
      .GetLifecycle(rosterID)
      .then((response) => {
        if (active) {
          setPlan(response.plan);
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
  }, [canManageChorePlans, planClient, rosterID]);

  const toggleSignups = async () => {
    if (!plan || plan.status === 'closed') {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedPlan =
        plan.status === 'open'
          ? await planClient.Close(rosterID)
          : await planClient.Open(rosterID);
      setPlan(updatedPlan);
    } catch (toggleError) {
      setError(requestErrorMessage(toggleError));
    } finally {
      setLoading(false);
    }
  };

  const reopenSignups = async (reason: string) => {
    if (!plan || plan.status !== 'closed' || !canReopenChorePlans) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedPlan = await planClient.Reopen(rosterID, reason.trim());
      setPlan(updatedPlan);
      setReviewingReopen(false);
    } catch (reopenError) {
      setReviewingReopen(false);
      setError(requestErrorMessage(reopenError));
    } finally {
      setLoading(false);
    }
  };

  return {
    canManageChorePlans,
    canReopenChorePlans,
    plan,
    loading,
    error,
    reviewingReopen,
    setReviewingReopen,
    toggleSignups,
    reopenSignups,
  };
}

export function useChoreSignupControls(
  planClient: ChoreSignupLifecycleClient = defaultPlanClient,
): ChoreSignupControlState {
  const currentRoster = useRecoilValue(CurrentRosterState);
  const roles = useRecoilValue(MyRolesState);
  const featureFlags = useRecoilValue(FeatureFlagsState);
  const permissions = useMemo(
    () => new Set(roles.flatMap((role) => role.permissions)),
    [roles],
  );
  const canManageChorePlans =
    featureFlags.chorePlanning && permissions.has('chorePlans:lifecycle');
  const canReopenChorePlans =
    canManageChorePlans && permissions.has('chorePlans:reopen');

  return useChoreSignupLifecycle({
    rosterID: currentRoster.id,
    canManageChorePlans,
    canReopenChorePlans,
    planClient,
  });
}

interface ChoreSignupButtonProps {
  plan: ChorePlanLifecycleState | null;
  loading: boolean;
  canReopen: boolean;
  onToggleSignups: () => void;
  onReviewReopen: () => void;
}

export function ChoreSignupButton({
  plan,
  loading,
  canReopen,
  onToggleSignups,
  onReviewReopen,
}: ChoreSignupButtonProps) {
  if (!plan) {
    return null;
  }
  const signupsAreOpen = plan.status === 'open';
  const signupsAreClosed = plan.status === 'closed';
  let buttonLabel = signupsAreOpen
    ? 'Close Chore Signups'
    : 'Open Chore Signups';
  if (signupsAreClosed) {
    buttonLabel = 'Reopen Chore Signups';
  }
  if (loading) {
    if (signupsAreOpen) {
      buttonLabel = 'Closing…';
    } else if (signupsAreClosed) {
      buttonLabel = 'Reopening…';
    } else {
      buttonLabel = 'Opening…';
    }
  }

  return (
    <Button
      color={signupsAreOpen ? 'warning' : 'success'}
      disabled={loading || (signupsAreClosed && !canReopen)}
      onClick={signupsAreClosed ? onReviewReopen : onToggleSignups}
      variant="outlined"
    >
      {buttonLabel}
    </Button>
  );
}

interface ChoreSignupControlsProps {
  canManageChorePlans: boolean;
  plan: ChorePlanLifecycleState | null;
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

export function ChoreSignupReopenDialog({
  open,
  loading,
  onClose,
  onReopen,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onReopen: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose}>
      <DialogTitle>Reopen chore signups</DialogTitle>
      <DialogContent>
        {/* PR #73 adds the self-service signup, removal, and switching behavior
        described by this lifecycle copy. */}
        <DialogContentText>
          Reopening lets verified roster members change their chore signups.
          Record the reason for this administrative change.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          inputProps={{ maxLength: 500 }}
          label="Reopening reason"
          margin="normal"
          multiline
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={loading || reason.trim().length === 0}
          onClick={() => onReopen(reason)}
          variant="contained"
        >
          {loading ? 'Reopening…' : 'Reopen signups'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
