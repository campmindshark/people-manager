import React, { useEffect, useMemo, useState } from 'react';
import { ChorePlanShiftViewResponse } from 'backend/view_models/chore_plan_shifts';
import {
  Alert,
  Box,
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
}

interface ChorePlanShiftViewProps {
  rosterID: number;
  planClient?: ChorePlanShiftClient;
}

const frontendConfig = getFrontendConfig();

function kindLabel(kind: 'chore' | 'event' | 'dinner'): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
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
                ? 'This release is read-only; signup controls arrive in the next slice.'
                : 'Assignments are read-only while the plan is closed.'}
            </Typography>
          </Stack>
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
