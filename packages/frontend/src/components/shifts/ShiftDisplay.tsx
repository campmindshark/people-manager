import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
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
  Tooltip,
  Typography,
} from '@mui/material';
import Schedule from 'backend/models/schedule/schedule';
import User from 'backend/models/user/user';
import { shiftTimeRangesOverlap } from 'backend/utils/shiftTime';
import { ChorePlanKind } from 'backend/view_models/chore_plan';
import ShiftViewModel, {
  SHIFT_SIGNUP_RESTRICTION_MESSAGES,
} from 'backend/view_models/shift';
import SignupStatus from 'backend/view_models/signup_status';
import {
  useRecoilRefresher_UNSTABLE,
  useRecoilValue,
  useRecoilValueLoadable,
} from 'recoil';
import CurrentRosterScheduleState from '../../state/schedules';
import { CurrentRosterState } from '../../state/roster';
import BackendShiftClient, {
  ShiftParticipantAssignment,
} from '../../api/shifts/shifts';
import BackendRosterClient from '../../api/roster/roster';
import { getFrontendConfig } from '../../config/config';
import {
  CurrentUserSignupStatus,
  MyShifts,
  UserState,
} from '../../state/store';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';
import FinalAssignmentsView, {
  assignmentsAreFinal,
} from './FinalAssignmentsView';

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};
const CATEGORY_ORDER: ChorePlanKind[] = ['chore', 'event', 'dinner'];
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const frontendConfig = getFrontendConfig();
const SELECTED_SHIFT_CONFLICT_REASON =
  'This shift conflicts with another shift you have selected.';

function shiftSignupName(participant: User): string {
  return participant instanceof User
    ? participant.shiftSignupName()
    : User.fromJson(participant).shiftSignupName();
}

export function adminRemainingShiftCount(
  status: SignupStatus,
  kind: ChorePlanKind,
): number {
  const signupCount = {
    chore: status.choreShiftCount,
    event: status.eventShiftCount,
    dinner: status.dinnerShiftCount,
  }[kind];
  return Math.max(0, status.requirements[kind] - signupCount);
}

export function eligibleAdminAssignees(
  statuses: SignupStatus[],
): SignupStatus[] {
  return statuses
    .filter(
      (status) =>
        status.hasSignedUpForRoster &&
        CATEGORY_ORDER.some(
          (kind) => adminRemainingShiftCount(status, kind) > 0,
        ),
    )
    .sort((first, second) =>
      User.fromJson(first.user)
        .displayName()
        .localeCompare(User.fromJson(second.user).displayName()),
    );
}

function adminAssigneeNeedsLabel(status: SignupStatus): string {
  return CATEGORY_ORDER.flatMap((kind) => {
    const remaining = adminRemainingShiftCount(status, kind);
    return remaining > 0
      ? [`${remaining} ${kind} shift${remaining === 1 ? '' : 's'}`]
      : [];
  }).join(', ');
}

function adminAssigneeOptionLabel(status: SignupStatus): string {
  const user = User.fromJson(status.user);
  return `${user.displayName()} — needs ${adminAssigneeNeedsLabel(status)}`;
}

export interface GeneratedSignupShift extends SignupSheetShift {
  kind: ChorePlanKind;
  shiftViewModel: ShiftViewModel;
}

export interface AdminParticipantSelection extends ShiftParticipantAssignment {
  participantName: string;
  shiftDescription: string;
}

export function adminAssignmentRestrictionReason(
  assignee: SignupStatus,
  shift: GeneratedSignupShift,
  allShifts: GeneratedSignupShift[],
): string | null {
  const assigneeID = Number(assignee.user.id);
  const assigneeName = User.fromJson(assignee.user).displayName();
  if (adminRemainingShiftCount(assignee, shift.kind) === 0) {
    return `${assigneeName} already has all required ${shift.kind} shifts.`;
  }
  if (
    shift.shiftViewModel.participants.some(
      (participant) => Number(participant.id) === assigneeID,
    )
  ) {
    return `${assigneeName} is already assigned to this shift.`;
  }
  const hasKnownConflict = allShifts.some(
    (existingShift) =>
      existingShift.shiftViewModel.shift.id !== shift.shiftViewModel.shift.id &&
      existingShift.shiftViewModel.participants.some(
        (participant) => Number(participant.id) === assigneeID,
      ) &&
      shiftTimeRangesOverlap(
        existingShift.shiftViewModel.shift,
        shift.shiftViewModel.shift,
      ),
  );
  return hasKnownConflict
    ? `${assigneeName} is already assigned to an overlapping shift.`
    : null;
}

export function toggleAdminParticipantSelection(
  selectedParticipants: AdminParticipantSelection[],
  participant: AdminParticipantSelection,
): AdminParticipantSelection[] {
  const selectedIndex = selectedParticipants.findIndex(
    (selectedParticipant) =>
      selectedParticipant.shiftID === participant.shiftID &&
      selectedParticipant.userID === participant.userID,
  );
  if (selectedIndex >= 0) {
    return selectedParticipants.filter((_, index) => index !== selectedIndex);
  }
  if (
    selectedParticipants.length >= 2 ||
    selectedParticipants.some(
      (selectedParticipant) =>
        selectedParticipant.userID === participant.userID,
    )
  ) {
    return selectedParticipants;
  }
  return [...selectedParticipants, participant];
}

interface SignupRequirementChip {
  label: string;
  color: 'default' | 'success' | 'warning';
}

export function signupRequirementChip(
  kind: ChorePlanKind,
  shifts: GeneratedSignupShift[],
  currentUserID: number,
  requirement: number,
): SignupRequirementChip {
  const planFinalized =
    shifts.length > 0 &&
    shifts.every((shift) => shift.shiftViewModel.chorePlanStatus === 'closed');
  if (planFinalized) {
    return { label: 'Signups closed', color: 'default' };
  }
  const signupsOpen =
    shifts.length > 0 &&
    shifts.every((shift) => shift.shiftViewModel.signupOpen);
  if (!signupsOpen) {
    return { label: 'Signups not open yet', color: 'default' };
  }

  const confirmedShiftCount = shifts.filter((shift) =>
    shift.shiftViewModel.participants.some(
      (participant) => Number(participant.id) === Number(currentUserID),
    ),
  ).length;
  const remainingShiftCount = Math.max(0, requirement - confirmedShiftCount);

  if (requirement === 0) {
    return {
      label: `${CATEGORY_LABELS[kind]} not required`,
      color: 'success',
    };
  }

  if (remainingShiftCount === 0) {
    return { label: 'Requirement complete!', color: 'success' };
  }

  return {
    label: `${remainingShiftCount} shift${
      remainingShiftCount === 1 ? '' : 's'
    } required!`,
    color: 'warning',
  };
}

function requestErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function toggleShiftSelection(
  selectedShiftIDs: number[],
  shiftID: number,
  selectionLimit: number,
): number[] {
  if (selectedShiftIDs.includes(shiftID)) {
    return selectedShiftIDs.filter((selectedID) => selectedID !== shiftID);
  }
  if (selectedShiftIDs.length >= selectionLimit) {
    return selectedShiftIDs;
  }
  return [...selectedShiftIDs, shiftID];
}

function isChorePlanKind(value: string): value is ChorePlanKind {
  return CATEGORY_ORDER.some((kind) => kind === value);
}

function generatedScheduleKind(schedule: Schedule): ChorePlanKind | null {
  if (!schedule.chorePlanID || !schedule.plannerKey) {
    return null;
  }
  const separatorIndex = schedule.plannerKey.indexOf('|');
  if (separatorIndex < 0) {
    return null;
  }
  const kind = schedule.plannerKey.slice(0, separatorIndex);
  const scheduleName = schedule.plannerKey.slice(separatorIndex + 1);
  return isChorePlanKind(kind) && scheduleName === schedule.name ? kind : null;
}

export function generatedSignupShift(
  schedule: Schedule,
  shiftViewModel: ShiftViewModel,
): GeneratedSignupShift | null {
  const kind = generatedScheduleKind(schedule);
  const { plannerKey } = shiftViewModel.shift;
  if (!kind || !plannerKey) {
    return null;
  }

  const scheduleSuffix = `|${schedule.name}`;
  if (!plannerKey.endsWith(scheduleSuffix)) {
    return null;
  }
  const metadata = plannerKey.slice(0, -scheduleSuffix.length).split('|');
  if (metadata[0] !== kind) {
    return null;
  }

  const day = Number(metadata[1]);
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    return null;
  }

  let periodOrder = 0;
  let timePeriod = TIME_FORMATTER.format(
    new Date(shiftViewModel.shift.startTime),
  );
  if (kind === 'event') {
    periodOrder = Number(metadata[2]);
    timePeriod = metadata.slice(3).join('|');
    if (!Number.isInteger(periodOrder) || periodOrder < 0 || !timePeriod) {
      return null;
    }
  } else if (kind === 'dinner') {
    timePeriod = metadata.slice(2).join('|');
    if (!timePeriod) {
      return null;
    }
  }

  return {
    key: `${schedule.id}|${shiftViewModel.shift.id}`,
    kind,
    scheduleName: schedule.name,
    day,
    timePeriod,
    periodOrder,
    shiftViewModel,
  };
}

interface SignupSlotsProps {
  shift: GeneratedSignupShift;
  currentUserID: number;
  signupSelected: boolean;
  removalSelected: boolean;
  selectionDisabled: boolean;
  selectionDisabledReason?: string | null;
  removalDisabled: boolean;
  onToggleSignup: (shiftID: number) => void;
  onToggleRemoval: (shiftID: number) => void;
  adminEditMode?: boolean;
  selectedAdminParticipants?: AdminParticipantSelection[];
  adminDestinationShiftID?: number | null;
  adminAssignee?: SignupStatus | null;
  adminAssignmentDisabledReason?: string | null;
  adminSubmitting?: boolean;
  onAdminAssign?: (shift: GeneratedSignupShift) => void;
  onToggleAdminParticipant?: (participant: AdminParticipantSelection) => void;
  onToggleAdminDestination?: (shiftID: number) => void;
}

export function SignupSlots({
  shift,
  currentUserID,
  signupSelected,
  removalSelected,
  selectionDisabled,
  selectionDisabledReason,
  removalDisabled,
  onToggleSignup,
  onToggleRemoval,
  adminEditMode = false,
  selectedAdminParticipants = [],
  adminDestinationShiftID = null,
  adminAssignee = null,
  adminAssignmentDisabledReason = null,
  adminSubmitting = false,
  onAdminAssign,
  onToggleAdminParticipant,
  onToggleAdminDestination,
}: SignupSlotsProps) {
  const { participants } = shift.shiftViewModel;
  const requiredParticipants = Number(
    shift.shiftViewModel.shift.requiredParticipants,
  );
  const slotCount = Math.max(requiredParticipants, participants.length);

  if (adminEditMode) {
    const adminSlotCount = Math.max(1, slotCount);
    const shiftID = shift.shiftViewModel.shift.id;
    const selectedSourceShiftID =
      selectedAdminParticipants.length === 1
        ? selectedAdminParticipants[0].shiftID
        : null;
    const showDestinationSelector = selectedAdminParticipants.length === 1;
    return (
      <div className="signup-sheet-admin-shift-controls">
        <span className="signup-sheet-slots">
          {Array.from({ length: adminSlotCount }, (_, index) => {
            const participant = participants[index];
            if (!participant) {
              const firstOpenSlot = index === participants.length;
              if (adminAssignee && firstOpenSlot) {
                const assigneeName = shiftSignupName(adminAssignee.user);
                const assignmentDisabled =
                  adminSubmitting || adminAssignmentDisabledReason !== null;
                return (
                  <Tooltip
                    describeChild
                    key={`${shift.key}|admin-slot-${index}`}
                    title={
                      assignmentDisabled
                        ? adminAssignmentDisabledReason ?? ''
                        : ''
                    }
                  >
                    <span className="signup-sheet-slot-tooltip">
                      <button
                        aria-label={`Add ${assigneeName} to ${shift.scheduleName}, day ${shift.day}, ${shift.timePeriod}`}
                        className="signup-sheet-slot signup-sheet-slot-button open"
                        disabled={assignmentDisabled}
                        onClick={() => onAdminAssign?.(shift)}
                        type="button"
                      >
                        Add {assigneeName}
                      </button>
                    </span>
                  </Tooltip>
                );
              }
              return (
                <span
                  className="signup-sheet-slot open"
                  key={`${shift.key}|admin-slot-${index}`}
                >
                  Open spot
                </span>
              );
            }
            const participantName = shiftSignupName(participant);
            const selected = selectedAdminParticipants.some(
              (selectedParticipant) =>
                selectedParticipant.shiftID === shiftID &&
                selectedParticipant.userID === Number(participant.id),
            );
            return (
              <button
                aria-label={`${
                  selected ? 'Deselect' : 'Select'
                } ${participantName} in ${shift.scheduleName}, day ${
                  shift.day
                }, ${shift.timePeriod} for admin shift editing`}
                aria-pressed={selected}
                className={`signup-sheet-slot signup-sheet-slot-button filled signup-sheet-admin-person-selector ${
                  selected ? 'selected' : ''
                }`}
                disabled={adminSubmitting}
                key={`${shift.key}|admin-slot-${index}`}
                onClick={() =>
                  onToggleAdminParticipant?.({
                    shiftID,
                    userID: Number(participant.id),
                    participantName,
                    shiftDescription: `${shift.scheduleName}, day ${shift.day}, ${shift.timePeriod}`,
                  })
                }
                type="button"
              >
                {participantName}
              </button>
            );
          })}
        </span>
        {showDestinationSelector && (
          <button
            aria-label={`${
              adminDestinationShiftID === shiftID ? 'Deselect' : 'Select'
            } ${shift.scheduleName}, day ${shift.day}, ${
              shift.timePeriod
            } as move destination`}
            aria-pressed={adminDestinationShiftID === shiftID}
            className={`signup-sheet-admin-destination-selector ${
              adminDestinationShiftID === shiftID ? 'selected' : ''
            }`}
            disabled={adminSubmitting || selectedSourceShiftID === shiftID}
            onClick={() => onToggleAdminDestination?.(shiftID)}
            type="button"
          >
            {adminDestinationShiftID === shiftID
              ? 'Destination selected'
              : 'Move here'}
          </button>
        )}
      </div>
    );
  }

  if (slotCount === 0) {
    return null;
  }

  return (
    <div className="signup-sheet-slots">
      {Array.from({ length: slotCount }, (_, index) => {
        const participant = participants[index];
        const participantIsCurrentUser =
          participant && Number(participant.id) === Number(currentUserID);
        const firstOpenSlot = !participant && index === participants.length;
        const slotSelected = firstOpenSlot && signupSelected;
        if (!participant) {
          const slotDisabled =
            !shift.shiftViewModel.signupOpen ||
            (!slotSelected && (selectionDisabled || signupSelected));
          return (
            <Tooltip
              describeChild
              key={`${shift.key}|slot-${index}`}
              title={slotDisabled ? selectionDisabledReason ?? '' : ''}
            >
              <span className="signup-sheet-slot-tooltip">
                <button
                  aria-label={`${
                    slotSelected ? 'Remove' : 'Select'
                  } open spot for ${shift.scheduleName}, day ${shift.day}, ${
                    shift.timePeriod
                  }`}
                  aria-pressed={slotSelected}
                  className={`signup-sheet-slot signup-sheet-slot-button ${
                    slotSelected ? 'selected' : 'open'
                  }`}
                  disabled={slotDisabled}
                  onClick={() => onToggleSignup(shift.shiftViewModel.shift.id)}
                  type="button"
                >
                  {slotSelected ? 'Selected' : 'Open spot'}
                </button>
              </span>
            </Tooltip>
          );
        }
        if (participantIsCurrentUser) {
          return (
            <button
              aria-label={`${
                removalSelected ? 'Keep' : 'Remove'
              } your spot for ${shift.scheduleName}, day ${shift.day}, ${
                shift.timePeriod
              }`}
              aria-pressed={removalSelected}
              className={`signup-sheet-slot signup-sheet-slot-button filled current-user ${
                removalSelected ? 'removal-selected' : ''
              }`}
              disabled={removalDisabled}
              key={`${shift.key}|slot-${index}`}
              onClick={() => onToggleRemoval(shift.shiftViewModel.shift.id)}
              type="button"
            >
              {shiftSignupName(participant)}
            </button>
          );
        }
        return (
          <span
            className="signup-sheet-slot filled other-user"
            key={`${shift.key}|slot-${index}`}
          >
            {shiftSignupName(participant)}
          </span>
        );
      })}
    </div>
  );
}

SignupSlots.defaultProps = {
  selectionDisabledReason: null,
  adminEditMode: false,
  selectedAdminParticipants: [],
  adminDestinationShiftID: null,
  adminAssignee: null,
  adminAssignmentDisabledReason: null,
  adminSubmitting: false,
  onAdminAssign: undefined,
  onToggleAdminParticipant: undefined,
  onToggleAdminDestination: undefined,
};

interface SignupCategoryProps {
  kind: ChorePlanKind;
  requirement: number;
  shifts: GeneratedSignupShift[];
  allShifts: GeneratedSignupShift[];
  shiftClient: BackendShiftClient;
  onSignupComplete: () => Promise<void>;
  adminEditMode?: boolean;
  selectedAdminParticipants?: AdminParticipantSelection[];
  adminDestinationShiftID?: number | null;
  adminAssignee?: SignupStatus | null;
  adminSubmitting?: boolean;
  onAdminAssign?: (shift: GeneratedSignupShift) => void;
  onToggleAdminParticipant?: (participant: AdminParticipantSelection) => void;
  onToggleAdminDestination?: (shiftID: number) => void;
}

export function SignupCategory({
  kind,
  requirement,
  shifts,
  allShifts,
  shiftClient,
  onSignupComplete,
  adminEditMode = false,
  selectedAdminParticipants = [],
  adminDestinationShiftID = null,
  adminAssignee = null,
  adminSubmitting = false,
  onAdminAssign,
  onToggleAdminParticipant,
  onToggleAdminDestination,
}: SignupCategoryProps) {
  const currentUser = useRecoilValue(UserState);
  const refreshSignupStatus = useRecoilRefresher_UNSTABLE(
    CurrentUserSignupStatus,
  );
  const refreshMyShifts = useRecoilRefresher_UNSTABLE(MyShifts);
  const [selectedShiftIDs, setSelectedShiftIDs] = useState<number[]>([]);
  const [selectedRemovalShiftIDs, setSelectedRemovalShiftIDs] = useState<
    number[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const signupLimit = requirement;
  const confirmedShiftCount = shifts.filter((shift) =>
    shift.shiftViewModel.participants.some(
      (participant) => Number(participant.id) === Number(currentUser.id),
    ),
  ).length;
  const remainingSignupCount = Math.max(0, signupLimit - confirmedShiftCount);
  const changeSourceShiftID =
    selectedRemovalShiftIDs.length === 1 ? selectedRemovalShiftIDs[0] : null;
  const selectionLimit = changeSourceShiftID ? 1 : remainingSignupCount;
  const changeReady =
    changeSourceShiftID !== null && selectedShiftIDs.length === 1;
  const signupsOpen = shifts.every((shift) => shift.shiftViewModel.signupOpen);
  const signupClosedReason =
    shifts.find((shift) => !shift.shiftViewModel.signupOpen)?.shiftViewModel
      .signupRestrictionReason ?? 'Signups are not open';
  const confirmedShifts = allShifts.filter((shift) =>
    shift.shiftViewModel.participants.some(
      (participant) => Number(participant.id) === Number(currentUser.id),
    ),
  );
  let signupGuidance = signupClosedReason;
  if (signupsOpen && changeSourceShiftID) {
    signupGuidance = `Select one open ${kind} shift as your replacement. Your current spot is kept unless the change succeeds.`;
  } else if (signupsOpen && signupLimit === 0) {
    signupGuidance = `No ${kind} shifts are required for you. You can remove or change any existing spots.`;
  } else if (signupsOpen && remainingSignupCount > 0) {
    signupGuidance = `You are signed up for ${confirmedShiftCount} of ${signupLimit}. Select up to ${remainingSignupCount} more; overlapping time blocks are unavailable.`;
  } else if (signupsOpen) {
    signupGuidance = `You are signed up for all ${signupLimit} required ${kind} shift${
      signupLimit === 1 ? '' : 's'
    }. Select one of your spots if you need to change it.`;
  }
  const removalButtonLabel =
    selectedRemovalShiftIDs.length === 1
      ? 'Remove shift'
      : `Remove shifts (${selectedRemovalShiftIDs.length})`;
  let submitButtonLabel = changeReady
    ? 'Change shift'
    : `Sign up (${selectedShiftIDs.length})`;
  if (submitting) {
    submitButtonLabel = changeReady ? 'Changing…' : 'Signing up…';
  }

  useEffect(() => {
    if (adminEditMode) {
      setSelectedShiftIDs([]);
      setSelectedRemovalShiftIDs([]);
      setError(null);
      setSuccess(null);
    }
  }, [adminEditMode]);

  const handleToggle = (shiftID: number) => {
    setError(null);
    setSuccess(null);
    setSelectedShiftIDs((selectedIDs) =>
      toggleShiftSelection(selectedIDs, shiftID, selectionLimit),
    );
  };

  const handleToggleRemoval = (shiftID: number) => {
    if (!signupsOpen) {
      return;
    }
    setError(null);
    setSuccess(null);
    const nextSelectedIDs = selectedRemovalShiftIDs.includes(shiftID)
      ? selectedRemovalShiftIDs.filter((selectedID) => selectedID !== shiftID)
      : [...selectedRemovalShiftIDs, shiftID];
    if (nextSelectedIDs.length !== 1 || selectedShiftIDs.length > 1) {
      setSelectedShiftIDs([]);
    }
    setSelectedRemovalShiftIDs(nextSelectedIDs);
  };

  const handleSignup = async () => {
    if (
      !signupsOpen ||
      selectedShiftIDs.length === 0 ||
      selectedRemovalShiftIDs.length > 0
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const signupCount = selectedShiftIDs.length;
      await shiftClient.EditChoreSignup(selectedShiftIDs, []);
      setSelectedShiftIDs([]);
      refreshSignupStatus();
      refreshMyShifts();
      setSuccess(
        `Signed up for ${signupCount} ${kind} shift${
          signupCount === 1 ? '' : 's'
        }.`,
      );
      try {
        await onSignupComplete();
      } catch (reloadError) {
        setError(
          `Your signup was saved, but the tables could not be refreshed: ${requestErrorMessage(
            reloadError,
          )}`,
        );
      }
    } catch (signupError) {
      setError(requestErrorMessage(signupError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = async () => {
    if (!signupsOpen || !changeSourceShiftID || selectedShiftIDs.length !== 1) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await shiftClient.EditChoreSignup(
        [selectedShiftIDs[0]],
        [changeSourceShiftID],
      );
      setSelectedRemovalShiftIDs([]);
      setSelectedShiftIDs([]);
      refreshSignupStatus();
      refreshMyShifts();
      setSuccess(`Changed your ${kind} shift.`);
      try {
        await onSignupComplete();
      } catch (reloadError) {
        setError(
          `Your shift was changed, but the tables could not be refreshed: ${requestErrorMessage(
            reloadError,
          )}`,
        );
      }
    } catch (changeError) {
      setError(requestErrorMessage(changeError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!signupsOpen || selectedRemovalShiftIDs.length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const removalCount = selectedRemovalShiftIDs.length;
      await shiftClient.EditChoreSignup([], selectedRemovalShiftIDs);
      setSelectedRemovalShiftIDs([]);
      refreshSignupStatus();
      refreshMyShifts();
      setSuccess(
        removalCount === 1
          ? `Removed your ${kind} shift.`
          : `Removed ${removalCount} ${kind} shifts.`,
      );
      try {
        await onSignupComplete();
      } catch (reloadError) {
        setError(
          `Your shift was removed, but the tables could not be refreshed: ${requestErrorMessage(
            reloadError,
          )}`,
        );
      }
    } catch (removeError) {
      setError(requestErrorMessage(removeError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2}>
      <SignupSheetTable
        emptyCellContent={null}
        kind={kind}
        shifts={shifts}
        renderShift={(shift) => {
          const shiftID = shift.shiftViewModel.shift.id;
          const selected = selectedShiftIDs.includes(shiftID);
          const currentUserIsConfirmed = shift.shiftViewModel.participants.some(
            (participant) => Number(participant.id) === Number(currentUser.id),
          );
          const selectedShifts = shifts.filter((candidate) =>
            selectedShiftIDs.includes(candidate.shiftViewModel.shift.id),
          );
          const conflictsWithConfirmedShift = confirmedShifts
            .filter(
              (confirmedShift) =>
                !selectedRemovalShiftIDs.includes(
                  confirmedShift.shiftViewModel.shift.id,
                ),
            )
            .some(
              (confirmedShift) =>
                confirmedShift.shiftViewModel.shift.id !== shiftID &&
                shiftTimeRangesOverlap(
                  shift.shiftViewModel.shift,
                  confirmedShift.shiftViewModel.shift,
                ),
            );
          const conflictsWithSelectedShift = selectedShifts.some(
            (selectedShift) =>
              selectedShift.shiftViewModel.shift.id !== shiftID &&
              shiftTimeRangesOverlap(
                shift.shiftViewModel.shift,
                selectedShift.shiftViewModel.shift,
              ),
          );
          const unresolvedSignupConflict = (
            shift.shiftViewModel.signupConflictShiftIDs ?? []
          ).some(
            (conflictingShiftID) =>
              !selectedRemovalShiftIDs.includes(conflictingShiftID),
          );
          const signupRestrictionResolvedByChange =
            shift.shiftViewModel.signupRestrictionReason ===
              SHIFT_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict &&
            (shift.shiftViewModel.signupConflictShiftIDs?.length ?? 0) > 0 &&
            !unresolvedSignupConflict;
          let selectionDisabledReason: string | null = null;
          if (!shift.shiftViewModel.signupOpen) {
            selectionDisabledReason =
              shift.shiftViewModel.signupRestrictionReason ??
              'Signups are not open';
          } else if (currentUserIsConfirmed) {
            selectionDisabledReason =
              'You are already signed up for this shift.';
          } else if (selectedRemovalShiftIDs.length > 1) {
            selectionDisabledReason =
              'Select only one of your current shifts to choose a replacement.';
          } else if (
            shift.shiftViewModel.signupRestrictionReason &&
            !signupRestrictionResolvedByChange
          ) {
            selectionDisabledReason =
              shift.shiftViewModel.signupRestrictionReason;
          } else if (conflictsWithConfirmedShift) {
            selectionDisabledReason =
              SHIFT_SIGNUP_RESTRICTION_MESSAGES.existingShiftConflict;
          } else if (conflictsWithSelectedShift) {
            selectionDisabledReason = SELECTED_SHIFT_CONFLICT_REASON;
          } else if (selectedShiftIDs.length >= selectionLimit) {
            selectionDisabledReason =
              'You have selected all of your remaining required shifts in this table.';
          }
          const selectionDisabled =
            submitting || selectionDisabledReason !== null;
          const adminAssignmentDisabledReason = adminAssignee
            ? adminAssignmentRestrictionReason(adminAssignee, shift, allShifts)
            : null;

          return (
            <SignupSlots
              adminEditMode={adminEditMode}
              adminDestinationShiftID={adminDestinationShiftID}
              adminAssignee={adminAssignee}
              adminAssignmentDisabledReason={adminAssignmentDisabledReason}
              adminSubmitting={adminSubmitting}
              currentUserID={currentUser.id}
              onToggleAdminDestination={onToggleAdminDestination}
              onToggleAdminParticipant={onToggleAdminParticipant}
              onAdminAssign={onAdminAssign}
              onToggleRemoval={handleToggleRemoval}
              onToggleSignup={handleToggle}
              removalSelected={selectedRemovalShiftIDs.includes(shiftID)}
              removalDisabled={!signupsOpen || submitting}
              selectionDisabled={selectionDisabled}
              selectionDisabledReason={selectionDisabledReason}
              selectedAdminParticipants={selectedAdminParticipants}
              signupSelected={selected}
              shift={shift}
            />
          );
        }}
      />
      {!adminEditMode && (
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
            {selectedRemovalShiftIDs.length > 0 && !changeReady && (
              <Button
                color="error"
                disabled={!signupsOpen || submitting}
                onClick={handleRemove}
                variant="contained"
              >
                {submitting ? 'Removing…' : removalButtonLabel}
              </Button>
            )}
            <Button
              disabled={
                !signupsOpen ||
                selectedShiftIDs.length === 0 ||
                (selectedRemovalShiftIDs.length > 0 && !changeReady) ||
                submitting
              }
              onClick={changeReady ? handleChange : handleSignup}
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

SignupCategory.defaultProps = {
  adminEditMode: false,
  selectedAdminParticipants: [],
  adminDestinationShiftID: null,
  adminAssignee: null,
  adminSubmitting: false,
  onAdminAssign: undefined,
  onToggleAdminParticipant: undefined,
  onToggleAdminDestination: undefined,
};

interface ShiftDisplayProps {
  adminEditMode?: boolean;
  mode?: 'signup' | 'final';
}

export default function ShiftDisplay({
  adminEditMode = false,
  mode = 'signup',
}: ShiftDisplayProps) {
  const schedules = useRecoilValueLoadable(CurrentRosterScheduleState);
  const currentUser = useRecoilValue(UserState);
  const signupStatus = useRecoilValue(CurrentUserSignupStatus);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const loadedSchedules =
    schedules.state === 'hasValue' ? schedules.contents : null;
  const shiftClient = useMemo(
    () => new BackendShiftClient(frontendConfig.BackendURL),
    [],
  );
  const rosterClient = useMemo(
    () => new BackendRosterClient(frontendConfig.BackendURL),
    [],
  );
  const generatedSchedules = useMemo(
    () =>
      loadedSchedules
        ? loadedSchedules.filter(
            (schedule) => generatedScheduleKind(schedule) !== null,
          )
        : [],
    [loadedSchedules],
  );
  const [generatedShifts, setGeneratedShifts] = useState<
    GeneratedSignupShift[]
  >([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const refreshSignupStatus = useRecoilRefresher_UNSTABLE(
    CurrentUserSignupStatus,
  );
  const refreshMyShifts = useRecoilRefresher_UNSTABLE(MyShifts);
  const [selectedAdminParticipants, setSelectedAdminParticipants] = useState<
    AdminParticipantSelection[]
  >([]);
  const [adminDestinationShiftID, setAdminDestinationShiftID] = useState<
    number | null
  >(null);
  const [adminForce, setAdminForce] = useState(false);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [adminAssignees, setAdminAssignees] = useState<SignupStatus[]>([]);
  const [selectedAdminAssigneeID, setSelectedAdminAssigneeID] = useState<
    number | null
  >(null);
  const [adminAssigneeLoadState, setAdminAssigneeLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');

  const loadGeneratedShifts = useCallback(async (): Promise<
    GeneratedSignupShift[]
  > => {
    const loadedShifts = await Promise.all(
      generatedSchedules.map(async (schedule) => {
        const shiftViewModels = await shiftClient.GetShiftViewModelsBySchedule(
          schedule.id,
        );
        return shiftViewModels.flatMap((shiftViewModel) => {
          const shift = generatedSignupShift(schedule, shiftViewModel);
          return shift ? [shift] : [];
        });
      }),
    );

    return loadedShifts
      .flat()
      .sort(
        (first, second) =>
          first.day - second.day ||
          CATEGORY_ORDER.indexOf(first.kind) -
            CATEGORY_ORDER.indexOf(second.kind) ||
          first.periodOrder - second.periodOrder ||
          first.scheduleName.localeCompare(second.scheduleName),
      );
  }, [generatedSchedules, shiftClient]);

  const reloadGeneratedShifts = useCallback(async () => {
    const loadedShifts = await loadGeneratedShifts();
    setGeneratedShifts(loadedShifts);
  }, [loadGeneratedShifts]);

  const loadEligibleAdminAssignees = useCallback(async () => {
    const statuses = await rosterClient.GetAllSignupStatusesForRoster(
      currentRoster.id,
    );
    return eligibleAdminAssignees(statuses);
  }, [currentRoster.id, rosterClient]);

  useEffect(() => {
    if (!adminEditMode) {
      setSelectedAdminParticipants([]);
      setAdminDestinationShiftID(null);
      setSelectedAdminAssigneeID(null);
      setAdminAssignees([]);
      setAdminAssigneeLoadState('idle');
      setAdminForce(false);
      setAdminError(null);
      setAdminSuccess(null);
      return undefined;
    }

    let active = true;
    setAdminAssigneeLoadState('loading');
    loadEligibleAdminAssignees()
      .then((assignees) => {
        if (!active) {
          return;
        }
        setAdminAssignees(assignees);
        setSelectedAdminAssigneeID((selectedID) =>
          assignees.some((status) => Number(status.user.id) === selectedID)
            ? selectedID
            : null,
        );
        setAdminAssigneeLoadState('ready');
      })
      .catch((error) => {
        console.error('Failed to load people needing shifts:', error);
        if (active) {
          setAdminAssignees([]);
          setSelectedAdminAssigneeID(null);
          setAdminAssigneeLoadState('error');
        }
      });

    return () => {
      active = false;
    };
  }, [adminEditMode, loadEligibleAdminAssignees]);

  const handleToggleAdminParticipant = (
    participant: AdminParticipantSelection,
  ) => {
    setAdminError(null);
    setAdminSuccess(null);
    setSelectedAdminAssigneeID(null);
    const nextParticipants = toggleAdminParticipantSelection(
      selectedAdminParticipants,
      participant,
    );
    setSelectedAdminParticipants(nextParticipants);
    if (nextParticipants.length !== 1) {
      setAdminDestinationShiftID(null);
    }
  };

  const handleAdminAssigneeChange = (event: SelectChangeEvent<number | ''>) => {
    const selectedID =
      event.target.value === '' ? null : Number(event.target.value);
    setSelectedAdminAssigneeID(selectedID);
    setSelectedAdminParticipants([]);
    setAdminDestinationShiftID(null);
    setAdminForce(false);
    setAdminError(null);
    setAdminSuccess(null);
  };

  const handleToggleAdminDestination = (shiftID: number) => {
    if (selectedAdminParticipants.length !== 1) {
      return;
    }
    setAdminError(null);
    setAdminSuccess(null);
    setAdminDestinationShiftID((selectedShiftID) =>
      selectedShiftID === shiftID ? null : shiftID,
    );
  };

  const refreshAfterAdminEdit = async (
    successMessage: string,
    staleTableMessage: string,
  ) => {
    setSelectedAdminParticipants([]);
    setAdminDestinationShiftID(null);
    setAdminForce(false);
    refreshSignupStatus();
    refreshMyShifts();
    setAdminSuccess(successMessage);
    setAdminAssigneeLoadState('loading');
    try {
      const [, assignees] = await Promise.all([
        reloadGeneratedShifts(),
        loadEligibleAdminAssignees(),
      ]);
      setAdminAssignees(assignees);
      setSelectedAdminAssigneeID((selectedID) =>
        assignees.some((status) => Number(status.user.id) === selectedID)
          ? selectedID
          : null,
      );
      setAdminAssigneeLoadState('ready');
    } catch (reloadError) {
      setAdminAssignees([]);
      setSelectedAdminAssigneeID(null);
      setAdminAssigneeLoadState('error');
      setAdminError(
        `${staleTableMessage}: ${requestErrorMessage(reloadError)}`,
      );
    }
  };

  const handleAssignParticipant = async (shift: GeneratedSignupShift) => {
    const selectedAssignee = adminAssignees.find(
      (status) => Number(status.user.id) === selectedAdminAssigneeID,
    );
    if (!selectedAssignee) {
      return;
    }
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const assigneeName = User.fromJson(selectedAssignee.user).displayName();
      await shiftClient.AssignParticipant({
        shiftID: shift.shiftViewModel.shift.id,
        userID: Number(selectedAssignee.user.id),
      });
      await refreshAfterAdminEdit(
        `${assigneeName} was assigned to ${shift.scheduleName}.`,
        'The person was assigned, but the tables could not be refreshed',
      );
    } catch (assignError) {
      setAdminError(requestErrorMessage(assignError));
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleMoveParticipant = async () => {
    if (selectedAdminParticipants.length !== 1 || !adminDestinationShiftID) {
      return;
    }
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const source = selectedAdminParticipants[0];
      await shiftClient.MoveParticipant(
        { shiftID: source.shiftID, userID: source.userID },
        adminDestinationShiftID,
        adminForce,
      );
      await refreshAfterAdminEdit(
        `${source.participantName} was ${
          adminForce ? 'force-moved' : 'moved'
        }.`,
        'The person was moved, but the tables could not be refreshed',
      );
    } catch (moveError) {
      setAdminError(requestErrorMessage(moveError));
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleSwapParticipants = async () => {
    if (selectedAdminParticipants.length !== 2) {
      return;
    }
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      await shiftClient.SwapParticipants(
        selectedAdminParticipants.map(({ shiftID, userID }) => ({
          shiftID,
          userID,
        })),
        adminForce,
      );
      await refreshAfterAdminEdit(
        `The selected people were ${adminForce ? 'force-swapped' : 'swapped'}.`,
        'The people were swapped, but the tables could not be refreshed',
      );
    } catch (swapError) {
      setAdminError(requestErrorMessage(swapError));
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleUnassignParticipant = async () => {
    if (selectedAdminParticipants.length !== 1) {
      return;
    }
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const selected = selectedAdminParticipants[0];
      await shiftClient.UnassignParticipant({
        shiftID: selected.shiftID,
        userID: selected.userID,
      });
      await refreshAfterAdminEdit(
        `${selected.participantName} was unassigned.`,
        'The person was unassigned, but the tables could not be refreshed',
      );
    } catch (unassignError) {
      setAdminError(requestErrorMessage(unassignError));
    } finally {
      setAdminSubmitting(false);
    }
  };

  useEffect(() => {
    if (schedules.state === 'hasError') {
      setLoadState('error');
      return undefined;
    }
    if (schedules.state !== 'hasValue') {
      setLoadState('loading');
      return undefined;
    }
    if (generatedSchedules.length === 0) {
      setGeneratedShifts([]);
      setLoadState('ready');
      return undefined;
    }

    let active = true;
    setLoadState('loading');
    loadGeneratedShifts()
      .then((loadedShifts) => {
        if (!active) {
          return;
        }
        setGeneratedShifts(loadedShifts);
        setLoadState('ready');
      })
      .catch((error) => {
        console.error('Failed to load generated shifts:', error);
        if (active) {
          setLoadState('error');
        }
      });

    return () => {
      active = false;
    };
  }, [generatedSchedules, loadGeneratedShifts, schedules.state]);

  if (loadState === 'loading') {
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading the signup sheets…
        </Typography>
      </Paper>
    );
  }

  if (loadState === 'error') {
    return (
      <Alert severity="error">
        The generated shift plan could not be loaded. Please try again.
      </Alert>
    );
  }

  if (generatedShifts.length === 0) {
    return (
      <Alert severity="info">
        There is no generated shift plan for the active roster yet.
      </Alert>
    );
  }

  if (mode === 'final') {
    if (!assignmentsAreFinal(generatedShifts)) {
      return (
        <Alert severity="info">
          Final assignments will be published here after chore signups close.
        </Alert>
      );
    }

    return (
      <FinalAssignmentsView
        currentUserID={currentUser.id}
        rosterYear={currentRoster.year}
        shifts={generatedShifts}
      />
    );
  }

  const adminDestination = generatedShifts.find(
    (shift) => shift.shiftViewModel.shift.id === adminDestinationShiftID,
  );
  const canSwapAdminParticipants =
    selectedAdminParticipants.length === 2 &&
    new Set(selectedAdminParticipants.map((participant) => participant.shiftID))
      .size === 2;
  const selectedAdminAssignee = adminAssignees.find(
    (status) => Number(status.user.id) === selectedAdminAssigneeID,
  );

  return (
    <Paper sx={{ p: { xs: 1, sm: 3 } }}>
      <Stack spacing={2}>
        {adminEditMode && (
          <Alert severity={adminForce ? 'warning' : 'info'}>
            <Stack spacing={1.5}>
              <Typography variant="body2">
                To add someone, choose a roster person who still needs shifts,
                then select an open spot. To change assignments, select one
                person to move or unassign, or two people to swap. Safe edits
                check capacity, attendance dates, time conflicts, roster,
                category, and signup requirements.
              </Typography>
              <FormControl
                disabled={
                  adminAssigneeLoadState !== 'ready' ||
                  adminAssignees.length === 0 ||
                  adminSubmitting
                }
                size="small"
                sx={{ maxWidth: 620 }}
              >
                <InputLabel id="admin-shift-assignee-label">
                  Person needing shifts
                </InputLabel>
                <Select<number | ''>
                  id="admin-shift-assignee"
                  label="Person needing shifts"
                  labelId="admin-shift-assignee-label"
                  onChange={handleAdminAssigneeChange}
                  value={selectedAdminAssigneeID ?? ''}
                >
                  <MenuItem value="">
                    <em>Select a person</em>
                  </MenuItem>
                  {adminAssignees.map((status) => (
                    <MenuItem
                      key={status.user.id}
                      value={Number(status.user.id)}
                    >
                      {adminAssigneeOptionLabel(status)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {adminAssigneeLoadState === 'loading' && (
                <Typography variant="caption">
                  Loading roster people who still need shifts…
                </Typography>
              )}
              {adminAssigneeLoadState === 'error' && (
                <Typography variant="caption">
                  People needing shifts could not be loaded. Exit and reopen
                  Admin Edit to try again.
                </Typography>
              )}
              {adminAssigneeLoadState === 'ready' &&
                adminAssignees.length === 0 && (
                  <Typography variant="caption">
                    Everyone on this roster has all of their required shifts.
                  </Typography>
                )}
              {selectedAdminAssignee && (
                <Typography variant="caption">
                  {User.fromJson(selectedAdminAssignee.user).displayName()}{' '}
                  still needs {adminAssigneeNeedsLabel(selectedAdminAssignee)}.
                  Select an enabled open spot below to add them.
                </Typography>
              )}
              {selectedAdminParticipants.length > 0 && (
                <Stack spacing={0.25}>
                  {selectedAdminParticipants.map((participant) => (
                    <Typography
                      key={`${participant.shiftID}|${participant.userID}`}
                      variant="caption"
                    >
                      {participant.participantName} —{' '}
                      {participant.shiftDescription}
                    </Typography>
                  ))}
                  {adminDestination && (
                    <Typography variant="caption">
                      Destination — {adminDestination.scheduleName}, day{' '}
                      {adminDestination.day}, {adminDestination.timePeriod}
                    </Typography>
                  )}
                </Stack>
              )}
              {!selectedAdminAssignee && (
                <>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={adminForce}
                        disabled={adminSubmitting}
                        onChange={(event) => {
                          setAdminForce(event.target.checked);
                          setAdminError(null);
                          setAdminSuccess(null);
                        }}
                        size="small"
                      />
                    }
                    label="Force (skip safety constraints)"
                  />
                  {adminForce && (
                    <Typography variant="caption">
                      Force skips capacity, attendance, time, roster, category,
                      and signup-requirement checks. Record integrity is still
                      enforced.
                    </Typography>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      color={adminForce ? 'warning' : 'primary'}
                      disabled={
                        selectedAdminParticipants.length !== 1 ||
                        !adminDestinationShiftID ||
                        adminSubmitting
                      }
                      onClick={handleMoveParticipant}
                      size="small"
                      variant="contained"
                    >
                      {adminSubmitting
                        ? 'Saving…'
                        : `${adminForce ? 'Force move' : 'Move person'}`}
                    </Button>
                    <Button
                      color={adminForce ? 'warning' : 'primary'}
                      disabled={!canSwapAdminParticipants || adminSubmitting}
                      onClick={handleSwapParticipants}
                      size="small"
                      variant="contained"
                    >
                      {adminSubmitting
                        ? 'Saving…'
                        : `${adminForce ? 'Force swap' : 'Swap people'}`}
                    </Button>
                    <Button
                      color="error"
                      disabled={
                        selectedAdminParticipants.length !== 1 ||
                        adminSubmitting
                      }
                      onClick={handleUnassignParticipant}
                      size="small"
                      variant="contained"
                    >
                      {adminSubmitting ? 'Saving…' : 'Unassign'}
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Alert>
        )}
        {adminError && <Alert severity="error">{adminError}</Alert>}
        {adminSuccess && <Alert severity="success">{adminSuccess}</Alert>}
        {CATEGORY_ORDER.map((kind) => {
          const categoryShifts = generatedShifts.filter(
            (shift) => shift.kind === kind,
          );
          const requirementChip = signupRequirementChip(
            kind,
            categoryShifts,
            currentUser.id,
            signupStatus.requirements[kind],
          );

          return (
            <Accordion key={kind} defaultExpanded={kind === 'chore'}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 0.5, sm: 2 }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Typography variant="h6">{CATEGORY_LABELS[kind]}</Typography>
                  <Box>
                    <Chip
                      color={requirementChip.color}
                      label={requirementChip.label}
                      size="small"
                    />
                  </Box>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 0, sm: 2 } }}>
                {categoryShifts.length ? (
                  <SignupCategory
                    adminEditMode={adminEditMode}
                    adminDestinationShiftID={adminDestinationShiftID}
                    adminAssignee={selectedAdminAssignee}
                    adminSubmitting={adminSubmitting}
                    allShifts={generatedShifts}
                    kind={kind}
                    requirement={signupStatus.requirements[kind]}
                    onSignupComplete={reloadGeneratedShifts}
                    onAdminAssign={handleAssignParticipant}
                    onToggleAdminDestination={handleToggleAdminDestination}
                    onToggleAdminParticipant={handleToggleAdminParticipant}
                    selectedAdminParticipants={selectedAdminParticipants}
                    shiftClient={shiftClient}
                    shifts={categoryShifts}
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
  );
}

ShiftDisplay.defaultProps = {
  adminEditMode: false,
  mode: 'signup',
};
