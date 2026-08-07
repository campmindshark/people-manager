import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { ChorePlanFinalAssignmentsResponse } from 'backend/view_models/chore_plan_final_assignments';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import BackendChorePlanClient from '../api/chore_plans/client';
import FinalAssignmentsView from '../components/shifts/FinalAssignmentsView';
import { getFrontendConfig } from '../config/config';
import Dashboard from '../layouts/dashboard/Dashboard';
import { CurrentRosterState } from '../state/roster';
import PageState, { CurrentUserIsVerified } from '../state/store';

export interface FinalAssignmentsClient {
  GetFinalAssignments: (
    rosterID: number,
  ) => Promise<ChorePlanFinalAssignmentsResponse>;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const { response } = error as {
      response?: { data?: { error?: string }; status?: number };
    };
    if (response?.data?.error) {
      return response.data.error;
    }
    if (response?.status === 403) {
      return 'Final assignments are available only to roster members.';
    }
    if (response?.status === 409) {
      return 'Final assignments are available after chore signups close.';
    }
  }
  return 'Could not load final assignments. Please try again.';
}

export function FinalAssignmentsContent({
  rosterID,
  planClient,
}: {
  rosterID: number;
  planClient?: FinalAssignmentsClient;
}) {
  const client = useMemo<FinalAssignmentsClient>(
    () =>
      planClient ?? new BackendChorePlanClient(getFrontendConfig().BackendURL),
    [planClient],
  );
  const [assignments, setAssignments] =
    useState<ChorePlanFinalAssignmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    client
      .GetFinalAssignments(rosterID)
      .then((response) => {
        if (active) {
          setAssignments(response);
        }
      })
      .catch((requestError) => {
        if (active) {
          setAssignments(null);
          setError(errorMessage(requestError));
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
  }, [client, revision, rosterID]);

  if (loading) {
    return (
      <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary">
          Loading final assignments…
        </Typography>
      </Stack>
    );
  }
  if (error) {
    return (
      <Alert
        severity="info"
        action={
          <Button
            color="inherit"
            onClick={() => setRevision((current) => current + 1)}
            size="small"
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }
  return assignments ? (
    <FinalAssignmentsView assignments={assignments} />
  ) : null;
}

FinalAssignmentsContent.defaultProps = {
  planClient: undefined,
};

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
          <div>
            <Typography component="h1" gutterBottom variant="h3">
              {currentRoster.year} final assignments
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
              Review the closed camp schedule or print category sheets for use
              on playa.
            </Typography>
          </div>
          {userIsVerified ? (
            <FinalAssignmentsContent rosterID={currentRoster.id} />
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
