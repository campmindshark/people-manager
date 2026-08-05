import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  CHORE_PLAN_KINDS,
  ChorePlanParticipantRequirements,
  ChorePlanRequirements,
  ChorePlanSummary,
} from 'backend/view_models/chore_plan';
import SignupStatus from 'backend/view_models/signup_status';
import BackendChorePlanClient from '../../api/chorePlans/client';
import BackendRosterClient from '../../api/roster/roster';
import { getFrontendConfig } from '../../config/config';

const frontendConfig = getFrontendConfig();
const chorePlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);

function requestErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function requirementsMatch(
  first: ChorePlanRequirements,
  second: ChorePlanRequirements,
): boolean {
  return CHORE_PLAN_KINDS.every((kind) => first[kind] === second[kind]);
}

interface ParticipantRequirementRowProps {
  plan: ChorePlanSummary;
  status: SignupStatus;
  onSaved: (result: ChorePlanParticipantRequirements) => void;
}

function ParticipantRequirementRow({
  plan,
  status,
  onSaved,
}: ParticipantRequirementRowProps) {
  const [requirements, setRequirements] = useState(status.requirements);
  const [reason, setReason] = useState(status.requirementExceptionReason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = plan.status === 'closed';
  const reduced = CHORE_PLAN_KINDS.some(
    (kind) => requirements[kind] < plan.requirements[kind],
  );
  const changed =
    !requirementsMatch(requirements, status.requirements) ||
    reason.trim() !== (status.requirementExceptionReason ?? '');
  const invalid = CHORE_PLAN_KINDS.some(
    (kind) =>
      !Number.isInteger(requirements[kind]) ||
      requirements[kind] < 0 ||
      requirements[kind] > plan.requirements[kind],
  );

  useEffect(() => {
    setRequirements(status.requirements);
    setReason(status.requirementExceptionReason ?? '');
  }, [status.requirementExceptionReason, status.requirements]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await chorePlanClient.SetParticipantRequirements(
        plan.rosterID,
        status.user.id,
        requirements,
        reason,
      );
      onSaved(result);
    } catch (saveError) {
      setError(requestErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await chorePlanClient.ResetParticipantRequirements(
        plan.rosterID,
        status.user.id,
      );
      onSaved(result);
    } catch (resetError) {
      setError(requestErrorMessage(resetError));
    } finally {
      setSaving(false);
    }
  };

  const name = status.user.playaName?.trim()
    ? `${status.user.playaName} (${status.user.firstName} ${status.user.lastName})`
    : `${status.user.firstName} ${status.user.lastName}`;

  return (
    <TableRow>
      <TableCell sx={{ minWidth: 180 }}>
        <Typography variant="body2">{name}</Typography>
        {status.hasCustomRequirements && (
          <Typography color="secondary" variant="caption">
            Custom requirements
          </Typography>
        )}
      </TableCell>
      {CHORE_PLAN_KINDS.map((kind) => (
        <TableCell key={kind}>
          <TextField
            aria-label={`${name} ${kind} requirement`}
            disabled={closed || saving}
            error={
              !Number.isInteger(requirements[kind]) ||
              requirements[kind] < 0 ||
              requirements[kind] > plan.requirements[kind]
            }
            inputProps={{ min: 0, max: plan.requirements[kind], step: 1 }}
            onChange={(event) =>
              setRequirements((current) => ({
                ...current,
                [kind]: Number(event.target.value),
              }))
            }
            size="small"
            type="number"
            value={requirements[kind]}
            sx={{ width: 84 }}
          />
        </TableCell>
      ))}
      <TableCell sx={{ minWidth: 260 }}>
        <TextField
          disabled={closed || saving}
          error={reduced && !reason.trim()}
          fullWidth
          inputProps={{ maxLength: 500 }}
          label="Reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Late arrival, accessibility, leadership role…"
          required={reduced}
          size="small"
          value={reason}
        />
        {error && (
          <Typography color="error" variant="caption" display="block">
            {error}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1}>
          <Button
            disabled={
              closed ||
              saving ||
              invalid ||
              !changed ||
              (reduced && !reason.trim())
            }
            onClick={save}
            size="small"
            variant="contained"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            disabled={closed || saving || !status.hasCustomRequirements}
            onClick={reset}
            size="small"
          >
            Use defaults
          </Button>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

interface ChoreRequirementExceptionsProps {
  plan: ChorePlanSummary;
  onChanged: () => Promise<void>;
}

export default function ChoreRequirementExceptions({
  plan,
  onChanged,
}: ChoreRequirementExceptionsProps) {
  const [statuses, setStatuses] = useState<SignupStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    rosterClient
      .GetAllSignupStatusesForRoster(plan.rosterID)
      .then((loadedStatuses) => {
        if (active) {
          setStatuses(
            [...loadedStatuses].sort((first, second) =>
              `${first.user.firstName} ${first.user.lastName}`.localeCompare(
                `${second.user.firstName} ${second.user.lastName}`,
              ),
            ),
          );
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
  }, [plan.id, plan.rosterID, plan.requirements]);

  const handleSaved = (result: ChorePlanParticipantRequirements) => {
    setStatuses((current) =>
      current.map((status) =>
        Number(status.user.id) === Number(result.userID)
          ? {
              ...status,
              requirements: result.requirements,
              hasCustomRequirements: result.hasCustomRequirements,
              requirementExceptionReason: result.requirementExceptionReason,
            }
          : status,
      ),
    );
    onChanged().catch((refreshError) => {
      setError(requestErrorMessage(refreshError));
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Member requirement exceptions</Typography>
          <Typography color="text.secondary">
            Plan defaults are {plan.requirements.chore} chore,{' '}
            {plan.requirements.event} event, and {plan.requirements.dinner}{' '}
            dinner shifts. Reduce a member&apos;s counts as needed; use 0 for an
            exemption and record the reason.
          </Typography>
        </Box>
        {plan.status === 'closed' && (
          <Alert severity="info">
            Requirements are read-only while this plan is closed. Reopen signups
            to make changes.
          </Alert>
        )}
        {loading && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={20} />
            <Typography color="text.secondary">
              Loading roster members…
            </Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && statuses.length === 0 && (
          <Alert severity="info">No roster members are signed up yet.</Alert>
        )}
        {statuses.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Chore</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Dinner</TableCell>
                  <TableCell>Exception reason</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statuses.map((status) => (
                  <ParticipantRequirementRow
                    key={status.user.id}
                    plan={plan}
                    status={status}
                    onSaved={handleSaved}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Paper>
  );
}
