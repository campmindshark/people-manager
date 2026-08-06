import React, { useEffect, useMemo, useState } from 'react';
import { ChorePlanShiftViewResponse } from 'backend/view_models/chore_plan_shifts';
import {
  ChorePlanSignupMutationResponse,
  ChorePlanSignupRequest,
  ChorePlanSwitchRequest,
} from 'backend/view_models/chore_plan_signup';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';

export interface ChorePlanShiftClient {
  GetShifts: (rosterID: number) => Promise<ChorePlanShiftViewResponse>;
  Signup: (
    rosterID: number,
    request: ChorePlanSignupRequest,
  ) => Promise<ChorePlanSignupMutationResponse>;
  Remove: (
    rosterID: number,
    shiftID: number,
  ) => Promise<ChorePlanSignupMutationResponse>;
  Switch: (
    rosterID: number,
    request: ChorePlanSwitchRequest,
  ) => Promise<ChorePlanSignupMutationResponse>;
}

interface ChorePlanShiftViewProps {
  rosterID: number;
  planClient?: ChorePlanShiftClient;
}

const frontendConfig = getFrontendConfig();

function kindLabel(kind: 'chore' | 'event' | 'dinner'): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

function mutationErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const { response } = error as {
      response?: { data?: { error?: string }; status?: number };
    };
    if (response?.data?.error) {
      return response.data.error;
    }
    if (response?.status === 404) {
      return 'Chore signup is unavailable. Refresh the page and try again.';
    }
  }
  return 'Could not update your chore assignment. Please try again.';
}

export default function ChorePlanShiftView({
  rosterID,
  planClient,
}: ChorePlanShiftViewProps) {
  const client = useMemo<ChorePlanShiftClient>(
    () => planClient ?? new BackendChorePlanClient(frontendConfig.BackendURL),
    [planClient],
  );
  const [response, setResponse] = useState<ChorePlanShiftViewResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingShiftID, setMutatingShiftID] = useState<number | null>(null);
  const [switchFromShiftID, setSwitchFromShiftID] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    setResponse(null);
    setError(null);

    client
      .GetShifts(rosterID)
      .then((nextResponse) => {
        if (active) {
          setResponse(nextResponse);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            'Chore plan shifts are available only to verified roster members.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [client, rosterID]);

  const mutate = async (
    shiftID: number,
    action: () => Promise<ChorePlanSignupMutationResponse>,
    successMessage: string,
  ) => {
    setMutatingShiftID(shiftID);
    setMutationError(null);
    setSuccess(null);
    try {
      const result = await action();
      setResponse(await client.GetShifts(rosterID));
      setSuccess(
        result.changed ? successMessage : 'Your assignments are unchanged.',
      );
      setSwitchFromShiftID(null);
    } catch (mutationFailure) {
      setMutationError(mutationErrorMessage(mutationFailure));
    } finally {
      setMutatingShiftID(null);
    }
  };

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!response) {
    return <Typography>Loading chore plan shifts...</Typography>;
  }
  if (!response.plan) {
    return (
      <Alert severity="info">No chore plan is available for this roster.</Alert>
    );
  }
  if (response.plan.status === 'draft') {
    return (
      <Alert severity="info">
        The chore plan is still being prepared. Generated shifts will appear
        after it opens.
      </Alert>
    );
  }

  return (
    <Paper>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Box>
          <Typography variant="h5">Camp chores, events, and dinners</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              color={
                response.selfServiceMutationsAllowed ? 'success' : 'default'
              }
              label={
                response.plan.status === 'open' ? 'Plan open' : 'Plan closed'
              }
              size="small"
            />
            <Typography color="text.secondary" variant="body2">
              {response.plan.status === 'open'
                ? 'Self-service signup, removal, and switching are open.'
                : 'Assignments are read-only while the plan is closed.'}
            </Typography>
          </Stack>
          {switchFromShiftID !== null && (
            <Alert
              action={
                <Button
                  color="inherit"
                  onClick={() => setSwitchFromShiftID(null)}
                  size="small"
                >
                  Cancel
                </Button>
              }
              severity="info"
              sx={{ mt: 2 }}
            >
              Choose the destination shift for your switch.
            </Alert>
          )}
          {mutationError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {mutationError}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
        </Box>

        {response.shifts.length === 0 ? (
          <Alert severity="warning">This plan has no generated shifts.</Alert>
        ) : (
          <TableContainer>
            <Table aria-label="Chore plan shifts" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Positions</TableCell>
                  <TableCell>Assigned</TableCell>
                  <TableCell>My status</TableCell>
                  {response.selfServiceMutationsAllowed && (
                    <TableCell>Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {response.shifts.map((shift) => (
                  <TableRow key={shift.stableKey}>
                    <TableCell>{shift.displayDayLabel}</TableCell>
                    <TableCell>{kindLabel(shift.kind)}</TableCell>
                    <TableCell>{shift.scheduleName}</TableCell>
                    <TableCell>{shift.timePeriodLabel}</TableCell>
                    <TableCell>
                      {shift.slots
                        .map(({ positionLabel }) => positionLabel)
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      {shift.assignedParticipantCount}/
                      {shift.requiredParticipants}
                    </TableCell>
                    <TableCell>
                      {shift.currentUserAssigned ? (
                        <Chip color="primary" label="Assigned" size="small" />
                      ) : (
                        'Not assigned'
                      )}
                    </TableCell>
                    {response.selfServiceMutationsAllowed && (
                      <TableCell>
                        {shift.currentUserAssigned ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              aria-label={`Remove ${shift.scheduleName}`}
                              disabled={mutatingShiftID !== null}
                              onClick={() =>
                                mutate(
                                  shift.id,
                                  () => client.Remove(rosterID, shift.id),
                                  `Removed ${shift.scheduleName}.`,
                                )
                              }
                              size="small"
                              variant="outlined"
                            >
                              Remove
                            </Button>
                            <Button
                              aria-label={`Switch from ${shift.scheduleName}`}
                              disabled={mutatingShiftID !== null}
                              onClick={() => setSwitchFromShiftID(shift.id)}
                              size="small"
                            >
                              Switch
                            </Button>
                          </Stack>
                        ) : (
                          <Button
                            aria-label={
                              switchFromShiftID === null
                                ? `Sign up for ${shift.scheduleName}`
                                : `Switch to ${shift.scheduleName}`
                            }
                            disabled={mutatingShiftID !== null}
                            onClick={() =>
                              switchFromShiftID === null
                                ? mutate(
                                    shift.id,
                                    () =>
                                      client.Signup(rosterID, {
                                        shiftID: shift.id,
                                      }),
                                    `Signed up for ${shift.scheduleName}.`,
                                  )
                                : mutate(
                                    shift.id,
                                    () =>
                                      client.Switch(rosterID, {
                                        fromShiftID: switchFromShiftID,
                                        toShiftID: shift.id,
                                      }),
                                    `Switched to ${shift.scheduleName}.`,
                                  )
                            }
                            size="small"
                            variant="contained"
                          >
                            {switchFromShiftID === null
                              ? 'Sign up'
                              : 'Switch here'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Paper>
  );
}

ChorePlanShiftView.defaultProps = {
  planClient: undefined,
};
