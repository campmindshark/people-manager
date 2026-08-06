import React, { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Roster from 'backend/models/roster/roster';
import {
  ChorePlanAdminAssignmentMutation,
  ChorePlanAdminAssignmentMutationResponse,
  ChorePlanAdminAssignmentParticipant,
  ChorePlanAdminAssignmentShift,
  ChorePlanAdminAssignmentViewResponse,
  ChorePlanForceAssignmentRequest,
} from 'backend/view_models/chore_plan_assignments';
import BackendChorePlanClient from '../../api/chore_plans/client';
import BackendRosterClient from '../../api/roster/roster';
import { getFrontendConfig } from '../../config/config';

type AssignmentOperation = ChorePlanAdminAssignmentMutation['operation'];

export interface ChorePlanAdminAssignmentClient {
  GetAdminAssignments: (
    rosterID: number,
  ) => Promise<ChorePlanAdminAssignmentViewResponse>;
  MutateAdminAssignments: (
    rosterID: number,
    mutation: ChorePlanAdminAssignmentMutation,
  ) => Promise<ChorePlanAdminAssignmentMutationResponse>;
  ForceAdminAssignments: (
    rosterID: number,
    request: ChorePlanForceAssignmentRequest,
  ) => Promise<ChorePlanAdminAssignmentMutationResponse>;
}

export interface ChorePlanAdminAssignmentRosterClient {
  GetAllRosters: () => Promise<Roster[]>;
}

interface ChorePlanAssignmentManagerProps {
  planClient?: ChorePlanAdminAssignmentClient;
  rosterClient?: ChorePlanAdminAssignmentRosterClient;
}

interface FormState {
  operation: AssignmentOperation;
  firstUserID: string;
  firstShiftID: string;
  destinationShiftID: string;
  secondUserID: string;
  secondShiftID: string;
  forced: boolean;
  reason: string;
}

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const defaultRosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const initialForm: FormState = {
  operation: 'assign',
  firstUserID: '',
  firstShiftID: '',
  destinationShiftID: '',
  secondUserID: '',
  secondShiftID: '',
  forced: false,
  reason: '',
};

function participantName(
  participant: ChorePlanAdminAssignmentParticipant,
): string {
  const legalName = `${participant.firstName} ${participant.lastName}`.trim();
  if (participant.playaName.trim()) {
    return `${legalName || `User ${participant.userID}`} (${participant.playaName})`;
  }
  return legalName || `User ${participant.userID}`;
}

function shiftName(shift: ChorePlanAdminAssignmentShift): string {
  return `${shift.displayDayLabel} — ${shift.scheduleName} — ${shift.timePeriodLabel}`;
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
      return 'You do not have permission to manage chore assignments.';
    }
    if (response?.status === 404) {
      return 'Chore assignment tools are unavailable for this roster.';
    }
  }
  return 'Could not update chore assignments. Please try again.';
}

function successMessage(
  result: ChorePlanAdminAssignmentMutationResponse,
  operation: AssignmentOperation,
): string {
  if (!result.changed) {
    return 'Assignments were already unchanged.';
  }
  if (result.forced && result.bypassedRules.length > 0) {
    return `Forced ${operation}; bypassed ${result.bypassedRules.join(', ')}.`;
  }
  return `${operation.charAt(0).toUpperCase()}${operation.slice(1)} completed.`;
}

function positiveID(value: string): number | null {
  return /^[1-9][0-9]*$/.test(value) ? Number(value) : null;
}

function buildMutation(
  form: FormState,
): ChorePlanAdminAssignmentMutation | null {
  const firstUserID = positiveID(form.firstUserID);
  const firstShiftID = positiveID(form.firstShiftID);
  if (firstUserID === null || firstShiftID === null) {
    return null;
  }
  if (form.operation === 'assign' || form.operation === 'unassign') {
    return {
      operation: form.operation,
      userID: firstUserID,
      shiftID: firstShiftID,
    };
  }
  if (form.operation === 'move') {
    const toShiftID = positiveID(form.destinationShiftID);
    return toShiftID === null
      ? null
      : {
          operation: 'move',
          userID: firstUserID,
          fromShiftID: firstShiftID,
          toShiftID,
        };
  }
  const secondUserID = positiveID(form.secondUserID);
  const secondShiftID = positiveID(form.secondShiftID);
  return secondUserID === null || secondShiftID === null
    ? null
    : {
        operation: 'swap',
        firstUserID,
        firstShiftID,
        secondUserID,
        secondShiftID,
      };
}

export default function ChorePlanAssignmentManager({
  planClient = defaultPlanClient,
  rosterClient = defaultRosterClient,
}: ChorePlanAssignmentManagerProps) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [rosterID, setRosterID] = useState('');
  const [view, setView] = useState<ChorePlanAdminAssignmentViewResponse | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rosterClient
      .GetAllRosters()
      .then((response) => {
        if (!active) {
          return;
        }
        const sorted = [...response].sort(
          (first, second) => second.year - first.year || second.id - first.id,
        );
        setRosters(sorted);
        setRosterID(sorted[0] ? String(sorted[0].id) : '');
        if (sorted.length === 0) {
          setError('Create a roster before managing chore assignments.');
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load rosters. Please try again.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [rosterClient]);

  useEffect(() => {
    const parsedRosterID = positiveID(rosterID);
    if (parsedRosterID === null) {
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setForm(initialForm);
    planClient
      .GetAdminAssignments(parsedRosterID)
      .then((response) => {
        if (active) {
          setView(response);
        }
      })
      .catch((loadError) => {
        if (active) {
          setView(null);
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
  }, [planClient, rosterID]);

  const participantsByID = useMemo(
    () =>
      new Map(
        view?.participants.map((participant) => [
          participant.userID,
          participant,
        ]),
      ),
    [view],
  );
  const shiftsByID = useMemo(
    () => new Map(view?.shifts.map((shift) => [shift.id, shift])),
    [view],
  );
  const firstParticipant = participantsByID.get(Number(form.firstUserID));
  const secondParticipant = participantsByID.get(Number(form.secondUserID));
  const firstSourceOptions =
    form.operation === 'assign'
      ? (view?.shifts ?? [])
      : (firstParticipant?.assignedShiftIDs ?? [])
          .map((id) => shiftsByID.get(id))
          .filter((shift): shift is ChorePlanAdminAssignmentShift =>
            Boolean(shift),
          );
  const secondSourceOptions = (secondParticipant?.assignedShiftIDs ?? [])
    .map((id) => shiftsByID.get(id))
    .filter((shift): shift is ChorePlanAdminAssignmentShift => Boolean(shift));

  const setField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleOperation = (event: SelectChangeEvent<AssignmentOperation>) => {
    setForm({
      ...initialForm,
      operation: event.target.value as AssignmentOperation,
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    const parsedRosterID = positiveID(rosterID);
    const mutation = buildMutation(form);
    if (parsedRosterID === null || !mutation) {
      setError(
        'Choose every participant and shift required by this operation.',
      );
      return;
    }
    if (form.forced && form.reason.trim().length === 0) {
      setError('Enter a reason before forcing an assignment change.');
      return;
    }
    setMutating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = form.forced
        ? await planClient.ForceAdminAssignments(parsedRosterID, {
            mutation,
            reason: form.reason.trim(),
          })
        : await planClient.MutateAdminAssignments(parsedRosterID, mutation);
      setView(await planClient.GetAdminAssignments(parsedRosterID));
      setSuccess(successMessage(result, mutation.operation));
      setForm({ ...initialForm, operation: form.operation });
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    } finally {
      setMutating(false);
    }
  };

  return (
    <Stack spacing={3}>
      <FormControl sx={{ maxWidth: 320 }}>
        <InputLabel id="assignment-roster-label">Roster</InputLabel>
        <Select
          label="Roster"
          labelId="assignment-roster-label"
          onChange={(event) => setRosterID(event.target.value)}
          value={rosterID}
        >
          {rosters.map((roster) => (
            <MenuItem key={roster.id} value={String(roster.id)}>
              {roster.year}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading && <CircularProgress aria-label="Loading chore assignments" />}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {!loading && view && !view.plan && (
        <Alert severity="info">No chore plan exists for this roster.</Alert>
      )}
      {!loading && view?.plan && (
        <>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`Plan ${view.plan.status}`} size="small" />
            <Typography color="text.secondary">
              {view.mutationsAllowed
                ? 'Administrative assignment changes are open.'
                : 'Reopen the plan before changing assignments.'}
            </Typography>
          </Stack>

          <Box component="section">
            <Typography variant="h6" gutterBottom>
              Current assignments
            </Typography>
            <TableContainer>
              <Table aria-label="Administrative chore assignments" size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Shift</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Participants</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shiftName(shift)}</TableCell>
                      <TableCell>{shift.kind}</TableCell>
                      <TableCell>
                        {shift.assignedUserIDs.length}/
                        {shift.requiredParticipants}
                      </TableCell>
                      <TableCell>
                        {shift.assignedUserIDs.length
                          ? shift.assignedUserIDs
                              .map((userID) => participantsByID.get(userID))
                              .map((participant, index) =>
                                participant
                                  ? participantName(participant)
                                  : `User ${shift.assignedUserIDs[index]}`,
                              )
                              .join(', ')
                          : 'Unassigned'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Stack component="section" spacing={2} sx={{ maxWidth: 720 }}>
            <Typography variant="h6">Change assignments</Typography>
            <FormControl>
              <InputLabel id="assignment-operation-label">Operation</InputLabel>
              <Select
                label="Operation"
                labelId="assignment-operation-label"
                onChange={handleOperation}
                value={form.operation}
              >
                <MenuItem value="assign">Assign</MenuItem>
                <MenuItem value="unassign">Unassign</MenuItem>
                <MenuItem value="move">Move</MenuItem>
                <MenuItem value="swap">Swap</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="first-participant-label">
                {form.operation === 'swap'
                  ? 'First participant'
                  : 'Participant'}
              </InputLabel>
              <Select
                label={
                  form.operation === 'swap'
                    ? 'First participant'
                    : 'Participant'
                }
                labelId="first-participant-label"
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    firstUserID: event.target.value,
                    firstShiftID: '',
                  }));
                }}
                value={form.firstUserID}
              >
                {view.participants.map((participant) => (
                  <MenuItem
                    key={participant.userID}
                    value={String(participant.userID)}
                  >
                    {participantName(participant)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="first-shift-label">
                {form.operation === 'assign' ? 'Shift' : 'Source shift'}
              </InputLabel>
              <Select
                label={form.operation === 'assign' ? 'Shift' : 'Source shift'}
                labelId="first-shift-label"
                onChange={(event) =>
                  setField('firstShiftID', event.target.value)
                }
                value={form.firstShiftID}
              >
                {firstSourceOptions.map((shift) => (
                  <MenuItem key={shift.id} value={String(shift.id)}>
                    {shiftName(shift)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.operation === 'move' && (
              <FormControl>
                <InputLabel id="destination-shift-label">
                  Destination shift
                </InputLabel>
                <Select
                  label="Destination shift"
                  labelId="destination-shift-label"
                  onChange={(event) =>
                    setField('destinationShiftID', event.target.value)
                  }
                  value={form.destinationShiftID}
                >
                  {view.shifts.map((shift) => (
                    <MenuItem key={shift.id} value={String(shift.id)}>
                      {shiftName(shift)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {form.operation === 'swap' && (
              <>
                <FormControl>
                  <InputLabel id="second-participant-label">
                    Second participant
                  </InputLabel>
                  <Select
                    label="Second participant"
                    labelId="second-participant-label"
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        secondUserID: event.target.value,
                        secondShiftID: '',
                      }));
                    }}
                    value={form.secondUserID}
                  >
                    {view.participants.map((participant) => (
                      <MenuItem
                        key={participant.userID}
                        value={String(participant.userID)}
                      >
                        {participantName(participant)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel id="second-shift-label">
                    Second source shift
                  </InputLabel>
                  <Select
                    label="Second source shift"
                    labelId="second-shift-label"
                    onChange={(event) =>
                      setField('secondShiftID', event.target.value)
                    }
                    value={form.secondShiftID}
                  >
                    {secondSourceOptions.map((shift) => (
                      <MenuItem key={shift.id} value={String(shift.id)}>
                        {shiftName(shift)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            {form.operation !== 'unassign' && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.forced}
                      onChange={(event) =>
                        setField('forced', event.target.checked)
                      }
                    />
                  }
                  label="Force rule conflicts (separate permission required)"
                />
                {form.forced && (
                  <TextField
                    inputProps={{ maxLength: 500 }}
                    label="Force reason"
                    multiline
                    onChange={(event) => setField('reason', event.target.value)}
                    required
                    value={form.reason}
                  />
                )}
              </>
            )}
            <Button
              disabled={!view.mutationsAllowed || mutating}
              onClick={handleSubmit}
              variant="contained"
            >
              {mutating ? 'Saving...' : `Run ${form.operation}`}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

ChorePlanAssignmentManager.defaultProps = {
  planClient: undefined,
  rosterClient: undefined,
};
