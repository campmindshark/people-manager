import React, { useEffect, useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChoreCatalogKind } from 'backend/view_models/chore_catalog';
import {
  CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES,
  ChorePlanShiftViewItem,
  ChorePlanShiftViewPlan,
  ChorePlanShiftViewResponse,
} from 'backend/view_models/chore_plan_shifts';
import { shiftTimeRangesOverlap } from 'backend/utils/shiftTime';
import {
  ChorePlanSignupMutationResponse,
  ChorePlanSignupRequest,
  ChorePlanSwitchRequest,
  MAX_CHORE_PLAN_SIGNUPS_PER_REQUEST,
} from 'backend/view_models/chore_plan_signup';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';
import { TimeOfDayFormatter } from '../../utils/datetime/formatter';
import ChorePlanAssignmentManager from '../admin/ChorePlanAssignmentManager';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';

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
  adminEditMode?: boolean;
  canForceAssignments?: boolean;
  planClient?: ChorePlanShiftClient;
}

interface MemberChorePlanShiftViewProps {
  rosterID: number;
  planClient?: ChorePlanShiftClient;
}

const frontendConfig = getFrontendConfig();
const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];
const CATEGORY_LABELS: Record<ChoreCatalogKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};

interface MemberSignupSheetShift extends SignupSheetShift {
  item: ChorePlanShiftViewItem;
}

interface SignupCategoryProps {
  kind: ChoreCatalogKind;
  plan: ChorePlanShiftViewPlan;
  shifts: ChorePlanShiftViewItem[];
  mutationsAllowed: boolean;
  onSignup: (shiftIDs: number[]) => Promise<ChorePlanSignupMutationResponse>;
  onRemove: (shiftID: number) => Promise<ChorePlanSignupMutationResponse>;
  onSwitch: (
    fromShiftID: number,
    toShiftID: number,
  ) => Promise<ChorePlanSignupMutationResponse>;
  onChanged: () => Promise<void>;
}

function signupSheetShift(
  item: ChorePlanShiftViewItem,
): MemberSignupSheetShift {
  return {
    key: item.stableKey,
    scheduleName: item.scheduleName,
    day: item.displayDayNumber,
    timePeriod: item.timePeriodLabel,
    periodOrder: item.periodOrder ?? 0,
    item,
  };
}

function requirementChip(
  kind: ChoreCatalogKind,
  plan: ChorePlanShiftViewPlan,
  shifts: ChorePlanShiftViewItem[],
): { color: 'default' | 'success' | 'warning'; label: string } {
  if (plan.status === 'closed') {
    return { color: 'default', label: 'Signups closed' };
  }

  const requirement = plan.requirements[kind];
  if (requirement === 0) {
    return {
      color: 'success',
      label: `${CATEGORY_LABELS[kind]} not required`,
    };
  }
  const assigned = shifts.filter(({ currentUserAssigned }) =>
    Boolean(currentUserAssigned),
  ).length;
  const remaining = Math.max(0, requirement - assigned);
  if (remaining === 0) {
    return { color: 'success', label: 'Requirement complete!' };
  }
  return {
    color: 'warning',
    label: `${remaining} shift${remaining === 1 ? '' : 's'} required!`,
  };
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

function signupRestrictionTooltip(
  shift: ChorePlanShiftViewItem,
  fallback: string | null,
): string | null {
  if (
    fallback !== CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict ||
    shift.signupConflicts.length === 0
  ) {
    return fallback;
  }

  const conflicts = shift.signupConflicts
    .map(
      ({ scheduleName, startTime, endTime }) =>
        `${scheduleName} (${TimeOfDayFormatter.format(
          new Date(startTime),
        )} to ${TimeOfDayFormatter.format(new Date(endTime))})`,
    )
    .join('; ');
  const label =
    shift.signupConflicts.length === 1 ? 'assignment' : 'assignments';
  return `${fallback} Conflicting ${label}: ${conflicts}.`;
}

function SignupSlots({
  shift,
  mutationsAllowed,
  signupSelected,
  removalSelected,
  selectionDisabled,
  selectionDisabledReason,
  submitting,
  onToggleSignup,
  onToggleRemoval,
}: {
  shift: ChorePlanShiftViewItem;
  mutationsAllowed: boolean;
  signupSelected: boolean;
  removalSelected: boolean;
  selectionDisabled: boolean;
  selectionDisabledReason: string | null;
  submitting: boolean;
  onToggleSignup: () => void;
  onToggleRemoval: () => void;
}) {
  const slotCount = Math.max(
    shift.requiredParticipants,
    shift.slots.length,
    shift.assignments.length,
  );

  if (slotCount === 0) {
    return null;
  }

  return (
    <div className="signup-sheet-slots">
      {Array.from({ length: slotCount }, (_, index) => {
        const assignment = shift.assignments[index];
        if (assignment) {
          if (assignment.currentUser && mutationsAllowed) {
            return (
              <button
                aria-label={`${
                  removalSelected ? 'Keep' : 'Remove'
                } your spot for ${shift.scheduleName}, day ${
                  shift.displayDayNumber
                }, ${shift.timePeriodLabel}`}
                aria-pressed={removalSelected}
                className={`signup-sheet-slot signup-sheet-slot-button filled current-user ${
                  removalSelected ? 'removal-selected' : ''
                }`}
                disabled={submitting}
                key={`${shift.stableKey}|slot-${index}`}
                onClick={onToggleRemoval}
                type="button"
              >
                {assignment.displayName}
              </button>
            );
          }
          return (
            <span
              className={`signup-sheet-slot filled ${
                assignment.currentUser ? 'current-user' : 'other-user'
              }`}
              key={`${shift.stableKey}|slot-${index}`}
            >
              {assignment.displayName}
            </span>
          );
        }

        const firstOpenSlot = index === shift.assignments.length;
        const slotSelected = firstOpenSlot && signupSelected;
        if (mutationsAllowed) {
          const slotDisabled =
            submitting ||
            (!slotSelected && (selectionDisabled || signupSelected));
          return (
            <Tooltip
              describeChild
              key={`${shift.stableKey}|slot-${index}`}
              title={slotDisabled ? (selectionDisabledReason ?? '') : ''}
            >
              <span className="signup-sheet-slot-tooltip">
                <button
                  aria-label={`${
                    slotSelected ? 'Deselect' : 'Select'
                  } open spot for ${shift.scheduleName}, day ${
                    shift.displayDayNumber
                  }, ${shift.timePeriodLabel}`}
                  aria-pressed={slotSelected}
                  className={`signup-sheet-slot signup-sheet-slot-button ${
                    slotSelected ? 'selected' : 'open'
                  }`}
                  disabled={slotDisabled}
                  onClick={onToggleSignup}
                  type="button"
                >
                  {slotSelected ? 'Selected' : 'Open spot'}
                </button>
              </span>
            </Tooltip>
          );
        }
        return (
          <span
            className="signup-sheet-slot open"
            key={`${shift.stableKey}|slot-${index}`}
          >
            Open spot
          </span>
        );
      })}
    </div>
  );
}

function SignupCategory({
  kind,
  plan,
  shifts,
  mutationsAllowed,
  onSignup,
  onRemove,
  onSwitch,
  onChanged,
}: SignupCategoryProps) {
  const [selectedShiftIDs, setSelectedShiftIDs] = useState<number[]>([]);
  const [selectedRemovalShiftID, setSelectedRemovalShiftID] = useState<
    number | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requirement = plan.requirements[kind];
  const confirmedShiftCount = shifts.filter(
    ({ currentUserAssigned }) => currentUserAssigned,
  ).length;
  const remainingSignupCount = Math.max(0, requirement - confirmedShiftCount);
  const selectionLimit =
    selectedRemovalShiftID === null
      ? Math.min(remainingSignupCount, MAX_CHORE_PLAN_SIGNUPS_PER_REQUEST)
      : 1;
  const changeReady =
    selectedRemovalShiftID !== null && selectedShiftIDs.length === 1;
  let submitButtonLabel = changeReady
    ? 'Change shift'
    : `Sign up (${selectedShiftIDs.length})`;
  if (submitting) {
    submitButtonLabel = changeReady ? 'Changing…' : 'Signing up…';
  }
  let signupGuidance = 'Signups are not open';
  if (mutationsAllowed && selectedRemovalShiftID !== null) {
    signupGuidance = `Select one open ${kind} shift as your replacement. Your current spot is kept unless the change succeeds.`;
  } else if (mutationsAllowed && requirement === 0) {
    signupGuidance = `No ${kind} shifts are required for you. You can remove or change any existing spots.`;
  } else if (mutationsAllowed && remainingSignupCount > 0) {
    signupGuidance = `You are signed up for ${confirmedShiftCount} of ${requirement}. Select up to ${selectionLimit} more; overlapping time blocks are unavailable.`;
  } else if (mutationsAllowed) {
    signupGuidance = `You are signed up for all ${requirement} required ${kind} shift${
      requirement === 1 ? '' : 's'
    }. Select one of your spots if you need to change it.`;
  }

  const performMutation = async (
    action: () => Promise<ChorePlanSignupMutationResponse>,
    successMessage: string,
  ) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      await onChanged();
      setSuccess(
        result.changed ? successMessage : 'Your assignments are unchanged.',
      );
      setSelectedShiftIDs([]);
      setSelectedRemovalShiftID(null);
    } catch (mutationFailure) {
      setError(mutationErrorMessage(mutationFailure));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = () => {
    if (selectedShiftIDs.length === 0) {
      return;
    }
    const signupCount = selectedShiftIDs.length;
    performMutation(
      () => onSignup(selectedShiftIDs),
      `Signed up for ${signupCount} ${kind} shift${
        signupCount === 1 ? '' : 's'
      }.`,
    );
  };

  const handleRemove = () => {
    if (selectedRemovalShiftID === null) {
      return;
    }
    const selectedShift = shifts.find(
      ({ id }) => id === selectedRemovalShiftID,
    );
    performMutation(
      () => onRemove(selectedRemovalShiftID),
      `Removed ${selectedShift?.scheduleName ?? 'the selected shift'}.`,
    );
  };

  const handleSwitch = () => {
    const [selectedShiftID] = selectedShiftIDs;
    if (selectedRemovalShiftID === null || selectedShiftID === undefined) {
      return;
    }
    const selectedShift = shifts.find(({ id }) => id === selectedShiftID);
    performMutation(
      () => onSwitch(selectedRemovalShiftID, selectedShiftID),
      `Changed to ${selectedShift?.scheduleName ?? 'the selected shift'}.`,
    );
  };

  return (
    <Stack spacing={2}>
      <SignupSheetTable
        emptyCellContent={null}
        kind={kind}
        shifts={shifts.map(signupSheetShift)}
        renderShift={({ item }) => {
          const selected = selectedShiftIDs.includes(item.id);
          const conflictsWithSelectedShift = shifts
            .filter(({ id }) => selectedShiftIDs.includes(id))
            .some(
              (selectedShift) =>
                selectedShift.id !== item.id &&
                shiftTimeRangesOverlap(selectedShift, item),
            );
          const unresolvedSignupConflict = item.signupConflictShiftIDs.some(
            (conflictingShiftID) =>
              conflictingShiftID !== selectedRemovalShiftID,
          );
          const signupRestrictionResolvedByChange =
            item.signupRestrictionReason ===
              CHORE_PLAN_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict &&
            item.signupConflictShiftIDs.length > 0 &&
            !unresolvedSignupConflict;
          let selectionDisabledReason: string | null = null;
          if (selected) {
            selectionDisabledReason =
              'You can select only one spot in this shift.';
          } else if (item.currentUserAssigned) {
            selectionDisabledReason =
              'You are already signed up for this shift.';
          } else if (
            item.signupRestrictionReason &&
            !signupRestrictionResolvedByChange
          ) {
            selectionDisabledReason = item.signupRestrictionReason;
          } else if (conflictsWithSelectedShift) {
            selectionDisabledReason =
              'This shift conflicts with another shift you have selected.';
          } else if (selectedShiftIDs.length >= selectionLimit) {
            if (selectedRemovalShiftID !== null) {
              selectionDisabledReason =
                'Select only one open shift as your replacement.';
            } else if (remainingSignupCount === 0) {
              selectionDisabledReason =
                requirement === 0
                  ? `No ${kind} shifts are required for you.`
                  : `You already have all required ${kind} assignments. Select one of your current shifts to choose a replacement.`;
            } else {
              selectionDisabledReason = `You can select up to ${selectionLimit} shifts at a time.`;
            }
          }
          return (
            <SignupSlots
              mutationsAllowed={mutationsAllowed}
              onToggleRemoval={() => {
                setError(null);
                setSuccess(null);
                const nextRemovalShiftID =
                  selectedRemovalShiftID === item.id ? null : item.id;
                if (nextRemovalShiftID !== selectedRemovalShiftID) {
                  setSelectedShiftIDs([]);
                }
                setSelectedRemovalShiftID(nextRemovalShiftID);
              }}
              onToggleSignup={() => {
                setError(null);
                setSuccess(null);
                setSelectedShiftIDs((current) =>
                  current.includes(item.id)
                    ? current.filter((shiftID) => shiftID !== item.id)
                    : [...current, item.id].slice(0, selectionLimit),
                );
              }}
              removalSelected={selectedRemovalShiftID === item.id}
              selectionDisabled={selectionDisabledReason !== null}
              selectionDisabledReason={signupRestrictionTooltip(
                item,
                selectionDisabledReason,
              )}
              shift={item}
              signupSelected={selected}
              submitting={submitting}
            />
          );
        }}
      />
      {mutationsAllowed && (
        <Stack
          alignItems={{ xs: 'stretch', sm: 'center' }}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1}
        >
          <Typography color="text.secondary" variant="body2">
            {signupGuidance}
          </Typography>
          <Stack direction="row" spacing={1}>
            {selectedRemovalShiftID !== null && !changeReady && (
              <Button
                color="error"
                disabled={submitting}
                onClick={handleRemove}
                variant="contained"
              >
                {submitting ? 'Removing…' : 'Remove shift'}
              </Button>
            )}
            <Button
              disabled={
                selectedShiftIDs.length === 0 ||
                (selectedRemovalShiftID !== null && !changeReady) ||
                submitting
              }
              onClick={changeReady ? handleSwitch : handleSignup}
              variant="contained"
            >
              {submitButtonLabel}
            </Button>
          </Stack>
        </Stack>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
    </Stack>
  );
}

function MemberChorePlanShiftView({
  rosterID,
  planClient,
}: MemberChorePlanShiftViewProps) {
  const client = useMemo<ChorePlanShiftClient>(
    () => planClient ?? new BackendChorePlanClient(frontendConfig.BackendURL),
    [planClient],
  );
  const [response, setResponse] = useState<ChorePlanShiftViewResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadShifts = async () => {
    setResponse(await client.GetShifts(rosterID));
  };

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
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading the signup sheets…
        </Typography>
      </Paper>
    );
  }
  const { plan } = response;
  if (!plan) {
    return (
      <Alert severity="info">No chore plan is available for this roster.</Alert>
    );
  }
  if (plan.status === 'draft') {
    return (
      <Alert severity="info">
        The chore plan is still being prepared. Generated shifts will appear
        after it opens.
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: { xs: 1, sm: 3 } }}>
      {response.shifts.length === 0 ? (
        <Alert severity="warning">This plan has no generated shifts.</Alert>
      ) : (
        KINDS.map((kind) => {
          const shifts = response.shifts.filter((shift) => shift.kind === kind);
          const status = requirementChip(kind, plan, shifts);
          return (
            <Accordion key={kind} defaultExpanded={kind === 'chore'}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0.5, sm: 2 }}
                >
                  <Typography variant="h6">{CATEGORY_LABELS[kind]}</Typography>
                  <Chip
                    color={status.color}
                    label={status.label}
                    size="small"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 0, sm: 2 } }}>
                {shifts.length ? (
                  <SignupCategory
                    kind={kind}
                    mutationsAllowed={response.selfServiceMutationsAllowed}
                    onChanged={loadShifts}
                    onRemove={(shiftID) => client.Remove(rosterID, shiftID)}
                    onSignup={(shiftIDs) =>
                      client.Signup(rosterID, { shiftIDs })
                    }
                    onSwitch={(fromShiftID, toShiftID) =>
                      client.Switch(rosterID, { fromShiftID, toShiftID })
                    }
                    plan={plan}
                    shifts={shifts}
                  />
                ) : (
                  <Typography color="text.secondary">
                    No {CATEGORY_LABELS[kind].toLowerCase()} were generated.
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
    </Paper>
  );
}

MemberChorePlanShiftView.defaultProps = {
  planClient: undefined,
};

export default function ChorePlanShiftView({
  rosterID,
  adminEditMode = false,
  canForceAssignments = false,
  planClient,
}: ChorePlanShiftViewProps) {
  if (adminEditMode) {
    return (
      <ChorePlanAssignmentManager
        canForceAssignments={canForceAssignments}
        rosterID={rosterID}
      />
    );
  }

  return (
    <MemberChorePlanShiftView rosterID={rosterID} planClient={planClient} />
  );
}

ChorePlanShiftView.defaultProps = {
  adminEditMode: false,
  canForceAssignments: false,
  planClient: undefined,
};
