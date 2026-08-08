import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  ChorePlanParticipantRequirements,
  ChorePlanRequirementOverrideClearRequest,
  ChorePlanRequirementOverrideMutationResponse,
  ChorePlanRequirementOverrideRequest,
  ChorePlanRequirementOverrideViewResponse,
} from 'backend/view_models/chore_plan_requirements';
import { ChorePlanRequirements } from 'backend/view_models/chore_plan_preview';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const KINDS = ['chore', 'event', 'dinner'] as const;

export interface ChoreRequirementOverrideClient {
  GetRequirementOverrides: (
    rosterID: number,
  ) => Promise<ChorePlanRequirementOverrideViewResponse>;
  SetRequirementOverride: (
    rosterID: number,
    userID: number,
    request: ChorePlanRequirementOverrideRequest,
  ) => Promise<ChorePlanRequirementOverrideMutationResponse>;
  ClearRequirementOverride: (
    rosterID: number,
    userID: number,
    request: ChorePlanRequirementOverrideClearRequest,
  ) => Promise<ChorePlanRequirementOverrideMutationResponse>;
}

interface ChoreRequirementOverridesProps {
  rosterID: number;
  planClient?: ChoreRequirementOverrideClient;
  onChanged?: () => void;
}

function participantName(
  participant: ChorePlanParticipantRequirements,
): string {
  const legalName = `${participant.firstName} ${participant.lastName}`.trim();
  if (participant.playaName.trim()) {
    return `${legalName || `User ${participant.userID}`} (${participant.playaName})`;
  }
  return legalName || `User ${participant.userID}`;
}

function requirementsMatch(
  first: ChorePlanRequirements,
  second: ChorePlanRequirements,
): boolean {
  return KINDS.every((kind) => first[kind] === second[kind]);
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
      return 'You do not have permission to manage participant requirements.';
    }
    if (response?.status === 404) {
      return 'Participant requirement tools are unavailable for this roster.';
    }
  }
  return 'Could not update participant requirements. Please try again.';
}

function ParticipantRequirementRow({
  participant,
  planRequirements,
  mutationsAllowed,
  rosterID,
  planClient,
  onSaved,
}: {
  participant: ChorePlanParticipantRequirements;
  planRequirements: ChorePlanRequirements;
  mutationsAllowed: boolean;
  rosterID: number;
  planClient: ChoreRequirementOverrideClient;
  onSaved: (result: ChorePlanRequirementOverrideMutationResponse) => void;
}) {
  const [requirements, setRequirements] = useState(participant.requirements);
  const [reason, setReason] = useState(participant.overrideReason ?? '');
  const [clearReason, setClearReason] = useState('');
  const [clearing, setClearing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = participantName(participant);

  useEffect(() => {
    setRequirements(participant.requirements);
    setReason(participant.overrideReason ?? '');
    setClearReason('');
    setClearing(false);
  }, [participant]);

  const invalid = KINDS.some(
    (kind) =>
      !Number.isInteger(requirements[kind]) ||
      requirements[kind] < 0 ||
      requirements[kind] > planRequirements[kind],
  );
  const reduced = KINDS.some(
    (kind) => requirements[kind] < planRequirements[kind],
  );
  const changed =
    !requirementsMatch(requirements, participant.requirements) ||
    reason.trim() !== (participant.overrideReason ?? '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await planClient.SetRequirementOverride(rosterID, participant.userID, {
          requirements,
          reason: reason.trim(),
        }),
      );
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await planClient.ClearRequirementOverride(
          rosterID,
          participant.userID,
          { reason: clearReason.trim() },
        ),
      );
      setClearing(false);
    } catch (clearError) {
      setClearing(false);
      setError(errorMessage(clearError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell sx={{ minWidth: 180 }}>
        <Typography variant="body2">{name}</Typography>
        {participant.hasOverride && (
          <Typography color="secondary" variant="caption">
            Custom requirements
          </Typography>
        )}
      </TableCell>
      {KINDS.map((kind) => (
        <TableCell key={kind}>
          <TextField
            disabled={!mutationsAllowed || saving}
            error={
              !Number.isInteger(requirements[kind]) ||
              requirements[kind] < 0 ||
              requirements[kind] > planRequirements[kind]
            }
            inputProps={{
              'aria-label': `${name} ${kind} requirement`,
              min: 0,
              max: planRequirements[kind],
              step: 1,
            }}
            onChange={(event) =>
              setRequirements((current) => ({
                ...current,
                [kind]: Number(event.target.value),
              }))
            }
            size="small"
            sx={{ width: 84 }}
            type="number"
            value={requirements[kind]}
          />
        </TableCell>
      ))}
      <TableCell sx={{ minWidth: 260 }}>
        <TextField
          disabled={!mutationsAllowed || saving}
          error={reduced && !reason.trim()}
          fullWidth
          inputProps={{ maxLength: 500 }}
          label="Override reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Accessibility, attendance, leadership role…"
          required={reduced}
          size="small"
          value={reason}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1}>
          <Button
            disabled={
              !mutationsAllowed ||
              saving ||
              invalid ||
              !reduced ||
              !changed ||
              !reason.trim()
            }
            onClick={save}
            size="small"
            variant="contained"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            disabled={!mutationsAllowed || saving || !participant.hasOverride}
            onClick={() => {
              setClearReason('');
              setClearing(true);
              setError(null);
            }}
            size="small"
          >
            Use defaults
          </Button>
        </Stack>
        <Dialog
          fullWidth
          maxWidth="sm"
          onClose={() => !saving && setClearing(false)}
          open={clearing}
        >
          <DialogTitle>Use plan defaults for {name}?</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              This clears all three custom requirements. Record why the
              exception is no longer needed.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              inputProps={{ maxLength: 500 }}
              label="Clear reason"
              multiline
              onChange={(event) => setClearReason(event.target.value)}
              required
              rows={3}
              value={clearReason}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={saving} onClick={() => setClearing(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !clearReason.trim()}
              onClick={clear}
              variant="contained"
            >
              {saving ? 'Clearing…' : 'Use defaults'}
            </Button>
          </DialogActions>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

export default function ChoreRequirementOverrides({
  rosterID,
  planClient = defaultPlanClient,
  onChanged = () => undefined,
}: ChoreRequirementOverridesProps) {
  const [view, setView] =
    useState<ChorePlanRequirementOverrideViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => planClient.GetRequirementOverrides(rosterID),
    [planClient, rosterID],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setView(null);
    setError(null);
    load()
      .then((response) => {
        if (active) {
          setView(response);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(errorMessage(loadError));
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
  }, [load]);

  const handleSaved = (
    result: ChorePlanRequirementOverrideMutationResponse,
  ) => {
    setView((current) =>
      current
        ? {
            ...current,
            participants: current.participants.map((participant) =>
              participant.userID === result.participant.userID
                ? result.participant
                : participant,
            ),
          }
        : current,
    );
    if (result.changed) {
      onChanged();
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress
          aria-label="Loading participant requirements"
          size={24}
        />
      </Paper>
    );
  }
  if (!view) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!view.plan) {
    return <Alert severity="info">No chore plan exists for this roster.</Alert>;
  }

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography component="h2" variant="h5">
            Member requirement exceptions
          </Typography>
          <Typography color="text.secondary">
            Plan defaults are {view.plan.requirements.chore} chore,{' '}
            {view.plan.requirements.event} event, and{' '}
            {view.plan.requirements.dinner} dinner shifts. Reduce all three
            values as a complete override; use 0 for an exemption and record a
            reason.
          </Typography>
        </Stack>
        {!view.mutationsAllowed && (
          <Alert severity="info">
            Requirements are read-only while this plan is closed. Reopen signups
            to make changes.
          </Alert>
        )}
        {view.participants.length === 0 ? (
          <Alert severity="info">No roster participants are available.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Chore</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Dinner</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {view.participants.map((participant) => (
                  <ParticipantRequirementRow
                    key={participant.userID}
                    mutationsAllowed={view.mutationsAllowed}
                    onSaved={handleSaved}
                    participant={participant}
                    planClient={planClient}
                    planRequirements={
                      view.plan?.requirements ?? {
                        chore: 0,
                        event: 0,
                        dinner: 0,
                      }
                    }
                    rosterID={rosterID}
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

ChoreRequirementOverrides.defaultProps = {
  planClient: defaultPlanClient,
  onChanged: () => undefined,
};
