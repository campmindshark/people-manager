import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ChoreCatalogKind } from 'backend/view_models/chore_catalog';
import {
  ChorePlanAdminAssignmentMutation,
  ChorePlanAdminAssignmentMutationResponse,
  ChorePlanAdminAssignmentParticipant,
  ChorePlanAdminAssignmentShift,
  ChorePlanAdminAssignmentViewResponse,
  ChorePlanForceAssignmentRequest,
} from 'backend/view_models/chore_plan_assignments';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';
import SignupSheetTable, { SignupSheetShift } from '../shifts/SignupSheetTable';

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

interface ChorePlanAssignmentManagerProps {
  rosterID: number;
  canForceAssignments?: boolean;
  planClient?: ChorePlanAdminAssignmentClient;
}

interface AdminParticipantSelection {
  userID: number;
  shiftID: number;
  participantName: string;
  shiftDescription: string;
}

interface AdminSignupSheetShift extends SignupSheetShift {
  shift: ChorePlanAdminAssignmentShift;
}

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];
const CATEGORY_LABELS: Record<ChoreCatalogKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};
const REFRESH_AFTER_MUTATION_ERROR =
  'The assignment change was saved, but the latest assignments could not be loaded. Refresh the page to continue.';

function participantName(
  participant: ChorePlanAdminAssignmentParticipant,
): string {
  const legalName = `${participant.firstName} ${participant.lastName}`.trim();
  if (participant.playaName.trim()) {
    return `${legalName || `User ${participant.userID}`} (${participant.playaName})`;
  }
  return legalName || `User ${participant.userID}`;
}

function shiftDescription(shift: ChorePlanAdminAssignmentShift): string {
  return `${shift.scheduleName}, day ${shift.displayDayNumber}, ${shift.timePeriodLabel}`;
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

function signupSheetShift(
  shift: ChorePlanAdminAssignmentShift,
): AdminSignupSheetShift {
  return {
    key: shift.stableKey,
    scheduleName: shift.scheduleName,
    day: shift.displayDayNumber,
    timePeriod: shift.timePeriodLabel,
    periodOrder: shift.periodOrder ?? 0,
    shift,
  };
}

function participantNeeds(
  participant: ChorePlanAdminAssignmentParticipant,
  view: ChorePlanAdminAssignmentViewResponse,
): { label: string; total: number } {
  const { plan } = view;
  if (!plan) {
    return { label: '', total: 0 };
  }
  const shiftsByID = new Map(view.shifts.map((shift) => [shift.id, shift]));
  const assigned: Record<ChoreCatalogKind, number> = {
    chore: 0,
    event: 0,
    dinner: 0,
  };
  participant.assignedShiftIDs.forEach((shiftID) => {
    const shift = shiftsByID.get(shiftID);
    if (shift) {
      assigned[shift.kind] += 1;
    }
  });
  const missing = KINDS.map((kind) => ({
    count: Math.max(0, plan.requirements[kind] - assigned[kind]),
    kind,
  })).filter(({ count }) => count > 0);
  return {
    label: missing
      .map(
        ({ count, kind }) => `${count} ${kind} shift${count === 1 ? '' : 's'}`,
      )
      .join(' · '),
    total: missing.reduce((total, { count }) => total + count, 0),
  };
}

function successMessage(
  result: ChorePlanAdminAssignmentMutationResponse,
  changedMessage: string,
): string {
  if (!result.changed) {
    return 'Assignments were already unchanged.';
  }
  if (result.forced && result.bypassedRules.length > 0) {
    return `${changedMessage} Bypassed: ${result.bypassedRules.join(', ')}.`;
  }
  return changedMessage;
}

function AdminSignupSlots({
  shift,
  participantsByID,
  selectedParticipants,
  destinationShiftID,
  assignee,
  force,
  mutationsAllowed,
  submitting,
  onAssign,
  onToggleParticipant,
  onToggleDestination,
}: {
  shift: ChorePlanAdminAssignmentShift;
  participantsByID: Map<number, ChorePlanAdminAssignmentParticipant>;
  selectedParticipants: AdminParticipantSelection[];
  destinationShiftID: number | null;
  assignee: ChorePlanAdminAssignmentParticipant | null;
  force: boolean;
  mutationsAllowed: boolean;
  submitting: boolean;
  onAssign: (shift: ChorePlanAdminAssignmentShift) => void;
  onToggleParticipant: (selection: AdminParticipantSelection) => void;
  onToggleDestination: (shiftID: number) => void;
}) {
  const baseSlotCount = Math.max(
    1,
    shift.requiredParticipants,
    shift.assignedUserIDs.length,
  );
  const slotCount =
    force &&
    assignee &&
    shift.assignedUserIDs.length >= shift.requiredParticipants
      ? baseSlotCount + 1
      : baseSlotCount;
  const selectedSourceShiftID =
    selectedParticipants.length === 1 ? selectedParticipants[0].shiftID : null;
  const showDestinationSelector =
    mutationsAllowed && !assignee && selectedParticipants.length === 1;

  return (
    <div className="signup-sheet-admin-shift-controls">
      <span className="signup-sheet-slots">
        {Array.from({ length: slotCount }, (_, index) => {
          const userID = shift.assignedUserIDs[index];
          if (userID === undefined) {
            const firstOpenSlot = index === shift.assignedUserIDs.length;
            if (assignee && firstOpenSlot && mutationsAllowed) {
              const name = participantName(assignee);
              const alreadyAssigned = shift.assignedUserIDs.includes(
                assignee.userID,
              );
              const action = force ? 'Force add' : 'Add';
              return (
                <button
                  aria-label={`${action} ${name} to ${shiftDescription(shift)}`}
                  className="signup-sheet-slot signup-sheet-slot-button open"
                  disabled={submitting || alreadyAssigned}
                  key={`${shift.stableKey}|admin-slot-${index}`}
                  onClick={() => onAssign(shift)}
                  type="button"
                >
                  {action} {name}
                </button>
              );
            }
            return (
              <span
                className="signup-sheet-slot open"
                key={`${shift.stableKey}|admin-slot-${index}`}
              >
                Open spot
              </span>
            );
          }

          const participant = participantsByID.get(userID);
          const name = participant
            ? participantName(participant)
            : `User ${userID}`;
          const selected = selectedParticipants.some(
            (selection) =>
              selection.shiftID === shift.id && selection.userID === userID,
          );
          return mutationsAllowed ? (
            <button
              aria-label={`${selected ? 'Deselect' : 'Select'} ${name} in ${shiftDescription(shift)} for admin shift editing`}
              aria-pressed={selected}
              className={`signup-sheet-slot signup-sheet-slot-button filled signup-sheet-admin-person-selector ${
                selected ? 'selected' : ''
              }`}
              disabled={submitting}
              key={`${shift.stableKey}|admin-slot-${index}`}
              onClick={() =>
                onToggleParticipant({
                  shiftID: shift.id,
                  userID,
                  participantName: name,
                  shiftDescription: shiftDescription(shift),
                })
              }
              type="button"
            >
              {name}
            </button>
          ) : (
            <span
              className="signup-sheet-slot filled other-user"
              key={`${shift.stableKey}|admin-slot-${index}`}
            >
              {name}
            </span>
          );
        })}
      </span>
      {showDestinationSelector && (
        <button
          aria-label={`${
            destinationShiftID === shift.id ? 'Deselect' : 'Select'
          } ${shiftDescription(shift)} as move destination`}
          aria-pressed={destinationShiftID === shift.id}
          className={`signup-sheet-admin-destination-selector ${
            destinationShiftID === shift.id ? 'selected' : ''
          }`}
          disabled={submitting || selectedSourceShiftID === shift.id}
          onClick={() => onToggleDestination(shift.id)}
          type="button"
        >
          {destinationShiftID === shift.id
            ? 'Destination selected'
            : 'Move here'}
        </button>
      )}
    </div>
  );
}

export default function ChorePlanAssignmentManager({
  rosterID,
  canForceAssignments = false,
  planClient = defaultPlanClient,
}: ChorePlanAssignmentManagerProps) {
  const [view, setView] = useState<ChorePlanAdminAssignmentViewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssigneeID, setSelectedAssigneeID] = useState<number | null>(
    null,
  );
  const [selectedParticipants, setSelectedParticipants] = useState<
    AdminParticipantSelection[]
  >([]);
  const [destinationShiftID, setDestinationShiftID] = useState<number | null>(
    null,
  );
  const [force, setForce] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadView = useCallback(
    () => planClient.GetAdminAssignments(rosterID),
    [planClient, rosterID],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setView(null);
    setError(null);
    setSuccess(null);
    setSelectedAssigneeID(null);
    setSelectedParticipants([]);
    setDestinationShiftID(null);
    setForce(false);
    setForceReason('');
    loadView()
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
  }, [loadView]);

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
  const selectedAssignee =
    participantsByID.get(selectedAssigneeID ?? 0) ?? null;
  const eligibleAssignees = useMemo(
    () =>
      view
        ? view.participants
            .map((participant) => ({
              needs: participantNeeds(participant, view),
              participant,
            }))
            .filter(({ needs }) => force || needs.total > 0)
        : [],
    [force, view],
  );
  const selectedDestination = view?.shifts.find(
    ({ id }) => id === destinationShiftID,
  );
  const canSwap =
    selectedParticipants.length === 2 &&
    selectedParticipants[0].shiftID !== selectedParticipants[1].shiftID;
  let moveButtonLabel = 'Move person';
  let swapButtonLabel = 'Swap people';
  if (submitting) {
    moveButtonLabel = 'Saving…';
    swapButtonLabel = 'Saving…';
  } else if (force) {
    moveButtonLabel = 'Force move';
    swapButtonLabel = 'Force swap';
  }

  const resetSelection = () => {
    setSelectedAssigneeID(null);
    setSelectedParticipants([]);
    setDestinationShiftID(null);
    setForce(false);
    setForceReason('');
  };

  const runMutation = async (
    mutation: ChorePlanAdminAssignmentMutation,
    changedMessage: string,
    allowForce = true,
  ) => {
    if (force && allowForce && forceReason.trim().length === 0) {
      setError('Enter a reason before forcing an assignment change.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    let result: ChorePlanAdminAssignmentMutationResponse;
    try {
      result =
        force && allowForce
          ? await planClient.ForceAdminAssignments(rosterID, {
              mutation,
              reason: forceReason.trim(),
            })
          : await planClient.MutateAdminAssignments(rosterID, mutation);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      setSubmitting(false);
      return;
    }

    setSuccess(successMessage(result, changedMessage));
    resetSelection();
    try {
      setView(await loadView());
    } catch (_refreshError) {
      setError(REFRESH_AFTER_MUTATION_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssigneeChange = (event: SelectChangeEvent<number | ''>) => {
    setSelectedAssigneeID(
      event.target.value === '' ? null : Number(event.target.value),
    );
    setSelectedParticipants([]);
    setDestinationShiftID(null);
    setForceReason('');
    setError(null);
    setSuccess(null);
  };

  const handleToggleParticipant = (selection: AdminParticipantSelection) => {
    setSelectedAssigneeID(null);
    setForceReason('');
    setError(null);
    setSuccess(null);
    const selected = selectedParticipants.some(
      ({ shiftID, userID }) =>
        shiftID === selection.shiftID && userID === selection.userID,
    );
    let next = selectedParticipants;
    if (selected) {
      next = selectedParticipants.filter(
        ({ shiftID, userID }) =>
          shiftID !== selection.shiftID || userID !== selection.userID,
      );
    } else if (
      selectedParticipants.length < 2 &&
      !selectedParticipants.some(({ userID }) => userID === selection.userID)
    ) {
      next = [...selectedParticipants, selection];
    }
    setSelectedParticipants(next);
    if (next.length !== 1) {
      setDestinationShiftID(null);
    }
  };

  const handleAssign = (shift: ChorePlanAdminAssignmentShift) => {
    if (!selectedAssignee) {
      return;
    }
    runMutation(
      {
        operation: 'assign',
        userID: selectedAssignee.userID,
        shiftID: shift.id,
      },
      `${participantName(selectedAssignee)} was assigned to ${shift.scheduleName}.`,
    );
  };

  const handleMove = () => {
    if (selectedParticipants.length !== 1 || !selectedDestination) {
      return;
    }
    const source = selectedParticipants[0];
    runMutation(
      {
        operation: 'move',
        userID: source.userID,
        fromShiftID: source.shiftID,
        toShiftID: selectedDestination.id,
      },
      `${source.participantName} was ${force ? 'force-moved' : 'moved'} to ${selectedDestination.scheduleName}.`,
    );
  };

  const handleSwap = () => {
    if (!canSwap) {
      return;
    }
    const [first, second] = selectedParticipants;
    runMutation(
      {
        operation: 'swap',
        firstUserID: first.userID,
        firstShiftID: first.shiftID,
        secondUserID: second.userID,
        secondShiftID: second.shiftID,
      },
      `The selected people were ${force ? 'force-swapped' : 'swapped'}.`,
    );
  };

  const handleUnassign = () => {
    if (selectedParticipants.length !== 1) {
      return;
    }
    const selected = selectedParticipants[0];
    runMutation(
      {
        operation: 'unassign',
        userID: selected.userID,
        shiftID: selected.shiftID,
      },
      `${selected.participantName} was unassigned.`,
      false,
    );
  };

  if (loading) {
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress aria-label="Loading chore assignments" size={28} />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading administrative signup sheets…
        </Typography>
      </Paper>
    );
  }
  if (!view) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!view.plan) {
    return <Alert severity="info">No chore plan exists for this roster.</Alert>;
  }
  const assigneeLabel = force
    ? 'Person to force assign'
    : 'Person needing shifts';
  const selectedAssigneeNeeds = selectedAssignee
    ? participantNeeds(selectedAssignee, view)
    : null;

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 1, sm: 3 } }}>
        <Stack spacing={2}>
          <Alert severity={force ? 'warning' : 'info'}>
            <Stack spacing={1.5}>
              <Typography variant="body2">
                To add someone, choose a roster person who still needs shifts,
                then select an open spot. To change assignments, select one
                person to move or unassign, or two people to swap. Safe edits
                check capacity, attendance dates, time conflicts, roster,
                category, and signup requirements. Force also makes complete
                roster participants and full shifts available for direct
                assignment.
              </Typography>
              <FormControl
                disabled={
                  !view.mutationsAllowed ||
                  eligibleAssignees.length === 0 ||
                  submitting
                }
                size="small"
                sx={{ maxWidth: 620 }}
              >
                <InputLabel id="admin-shift-assignee-label">
                  {assigneeLabel}
                </InputLabel>
                <Select<number | ''>
                  id="admin-shift-assignee"
                  label={assigneeLabel}
                  labelId="admin-shift-assignee-label"
                  onChange={handleAssigneeChange}
                  value={selectedAssigneeID ?? ''}
                >
                  <MenuItem value="">
                    <em>Select a person</em>
                  </MenuItem>
                  {eligibleAssignees.map(({ needs, participant }) => (
                    <MenuItem
                      key={participant.userID}
                      value={participant.userID}
                    >
                      {participantName(participant)} —{' '}
                      {needs.total > 0
                        ? `needs ${needs.label}`
                        : 'requirements complete'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!force && eligibleAssignees.length === 0 && (
                <Typography variant="caption">
                  Everyone on this roster has all of their required shifts.
                </Typography>
              )}
              {selectedAssignee && (
                <Typography variant="caption">
                  {participantName(selectedAssignee)}{' '}
                  {selectedAssigneeNeeds?.total
                    ? `still needs ${selectedAssigneeNeeds.label}.`
                    : 'has all required shifts.'}{' '}
                  Select an enabled spot below to add them.
                </Typography>
              )}
              {selectedParticipants.length > 0 && (
                <Stack spacing={0.25}>
                  {selectedParticipants.map((participant) => (
                    <Typography
                      key={`${participant.shiftID}|${participant.userID}`}
                      variant="caption"
                    >
                      {participant.participantName} —{' '}
                      {participant.shiftDescription}
                    </Typography>
                  ))}
                  {selectedDestination && (
                    <Typography variant="caption">
                      Destination — {shiftDescription(selectedDestination)}
                    </Typography>
                  )}
                </Stack>
              )}
              {canForceAssignments && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={force}
                      disabled={!view.mutationsAllowed || submitting}
                      onChange={(event) => {
                        const nextForce = event.target.checked;
                        setForce(nextForce);
                        if (!nextForce && selectedAssigneeNeeds?.total === 0) {
                          setSelectedAssigneeID(null);
                        }
                        setForceReason('');
                        setError(null);
                        setSuccess(null);
                      }}
                      size="small"
                    />
                  }
                  label="Force (skip safety constraints)"
                />
              )}
              {force && (
                <>
                  <Typography variant="caption">
                    Force may bypass capacity, attendance, time, and category
                    checks. Lifecycle, membership, generated-shift ownership,
                    and duplicate rules remain enforced.
                  </Typography>
                  <TextField
                    fullWidth
                    inputProps={{ maxLength: 500 }}
                    label="Force reason"
                    multiline
                    onChange={(event) => setForceReason(event.target.value)}
                    required
                    size="small"
                    value={forceReason}
                  />
                </>
              )}
              {!selectedAssignee && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    color={force ? 'warning' : 'primary'}
                    disabled={
                      !view.mutationsAllowed ||
                      selectedParticipants.length !== 1 ||
                      !destinationShiftID ||
                      submitting
                    }
                    onClick={handleMove}
                    size="small"
                    variant="contained"
                  >
                    {moveButtonLabel}
                  </Button>
                  <Button
                    color={force ? 'warning' : 'primary'}
                    disabled={!view.mutationsAllowed || !canSwap || submitting}
                    onClick={handleSwap}
                    size="small"
                    variant="contained"
                  >
                    {swapButtonLabel}
                  </Button>
                  <Button
                    color="error"
                    disabled={
                      !view.mutationsAllowed ||
                      selectedParticipants.length !== 1 ||
                      submitting
                    }
                    onClick={handleUnassign}
                    size="small"
                    variant="contained"
                  >
                    {submitting ? 'Saving…' : 'Unassign'}
                  </Button>
                </Stack>
              )}
            </Stack>
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          {KINDS.map((kind) => {
            const shifts = view.shifts.filter((shift) => shift.kind === kind);
            return (
              <Accordion key={kind} defaultExpanded={kind === 'chore'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0.5, sm: 2 }}
                  >
                    <Typography variant="h6">
                      {CATEGORY_LABELS[kind]}
                    </Typography>
                    <Chip label={`${shifts.length} shifts`} size="small" />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 0, sm: 2 } }}>
                  {shifts.length ? (
                    <SignupSheetTable
                      emptyCellContent={null}
                      kind={kind}
                      shifts={shifts.map(signupSheetShift)}
                      renderShift={({ shift }) => (
                        <AdminSignupSlots
                          assignee={selectedAssignee}
                          destinationShiftID={destinationShiftID}
                          force={force}
                          mutationsAllowed={view.mutationsAllowed}
                          onAssign={handleAssign}
                          onToggleDestination={(shiftID) => {
                            setDestinationShiftID((current) =>
                              current === shiftID ? null : shiftID,
                            );
                            setForceReason('');
                            setError(null);
                            setSuccess(null);
                          }}
                          onToggleParticipant={handleToggleParticipant}
                          participantsByID={participantsByID}
                          selectedParticipants={selectedParticipants}
                          shift={shift}
                          submitting={submitting}
                        />
                      )}
                    />
                  ) : (
                    <Typography color="text.secondary">
                      No {CATEGORY_LABELS[kind].toLowerCase()} were generated.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}

ChorePlanAssignmentManager.defaultProps = {
  canForceAssignments: false,
  planClient: defaultPlanClient,
};
