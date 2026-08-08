import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChorePlanChangeHistoryAssignment,
  ChorePlanChangeHistoryEntry,
  ChorePlanChangeHistoryResponse,
} from 'backend/view_models/chore_plan_change_history';
import { ChorePlanRequirements } from 'backend/view_models/chore_plan_preview';
import { BM_TIMEZONE } from 'backend/utils/burnDates';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';

const defaultClient = new BackendChorePlanClient(
  getFrontendConfig().BackendURL,
);
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BM_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export interface ChorePlanChangeHistoryClient {
  GetChangeHistory: (
    rosterID: number,
  ) => Promise<ChorePlanChangeHistoryResponse>;
}

interface ChorePlanChangeHistoryDialogProps {
  client?: ChorePlanChangeHistoryClient;
  onClose: () => void;
  open: boolean;
  rosterID: number;
  rosterYear: number;
}

function requirementsLabel(requirements: ChorePlanRequirements): string {
  return `${requirements.chore} chore, ${requirements.event} event, ${requirements.dinner} dinner`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function operationLabel(
  operation: 'assign' | 'unassign' | 'move' | 'swap',
): string {
  return `${operation.charAt(0).toUpperCase()}${operation.slice(1)}`;
}

export function changeHistoryEntryTitle(
  entry: ChorePlanChangeHistoryEntry,
): string {
  switch (entry.action) {
    case 'draft_applied':
      return 'Draft applied';
    case 'draft_replaced':
      return 'Draft replaced';
    case 'plan_opened':
      return 'Signups opened';
    case 'plan_closed':
      return 'Signups closed';
    case 'plan_reopened':
      return 'Signups reopened';
    case 'admin_assignment_mutated':
      return 'Administrative assignments changed';
    case 'participant_requirements_overridden':
      return 'Participant requirements changed';
    case 'participant_requirements_cleared':
      return 'Participant requirements reset';
    default:
      return 'Chore plan changed';
  }
}

export function changeHistoryEntryDescription(
  entry: ChorePlanChangeHistoryEntry,
): string {
  switch (entry.action) {
    case 'draft_applied':
      return `Applied draft revision ${entry.details.current.draftRevision} for ${entry.details.current.camperCount} campers with ${plural(
        entry.details.current.shiftCount,
        'shift',
      )} and ${plural(entry.details.current.slotCount, 'signup spot')}.`;
    case 'draft_replaced':
      return `Replaced draft revision ${
        entry.details.previous?.draftRevision ?? 'unknown'
      } with revision ${entry.details.current.draftRevision} for ${
        entry.details.current.camperCount
      } campers.`;
    case 'plan_opened':
      return 'Opened chore plan signups.';
    case 'plan_closed':
      return 'Closed chore plan signups.';
    case 'plan_reopened':
      return 'Reopened chore plan signups.';
    case 'admin_assignment_mutated':
      return `${entry.details.forced ? 'Forced ' : ''}${
        entry.details.operation
      } operation changed ${plural(
        entry.details.affectedAssignments.length,
        'assignment record',
      )}.`;
    case 'participant_requirements_overridden':
      return `Changed ${
        entry.details.participant.name
      }'s requirements from ${requirementsLabel(
        entry.details.previousRequirements,
      )} to ${requirementsLabel(entry.details.requirements)}.`;
    case 'participant_requirements_cleared':
      return `Reset ${
        entry.details.participant.name
      }'s requirements from ${requirementsLabel(
        entry.details.previousRequirements,
      )} to ${requirementsLabel(entry.details.requirements)}.`;
    default:
      return 'Changed the chore plan.';
  }
}

function entryReason(entry: ChorePlanChangeHistoryEntry): string | null {
  if (
    entry.action === 'plan_opened' ||
    entry.action === 'plan_closed' ||
    entry.action === 'plan_reopened' ||
    entry.action === 'admin_assignment_mutated' ||
    entry.action === 'participant_requirements_overridden' ||
    entry.action === 'participant_requirements_cleared'
  ) {
    return entry.details.reason;
  }
  return null;
}

function affectedAssignments(
  entry: ChorePlanChangeHistoryEntry,
): ChorePlanChangeHistoryAssignment[] {
  if (entry.action === 'admin_assignment_mutated') {
    return entry.details.affectedAssignments;
  }
  if (
    entry.action === 'participant_requirements_overridden' ||
    entry.action === 'participant_requirements_cleared'
  ) {
    return entry.details.removedAssignments;
  }
  return [];
}

function assignmentLabel(assignment: ChorePlanChangeHistoryAssignment): string {
  const shiftContext = [
    assignment.shift.displayDayLabel,
    assignment.shift.timePeriodLabel,
  ]
    .filter(Boolean)
    .join(', ');
  return `${assignment.action === 'added' ? 'Added' : 'Removed'} ${
    assignment.participant.name
  } ${assignment.action === 'added' ? 'to' : 'from'} ${
    assignment.shift.scheduleName
  }${shiftContext ? ` (${shiftContext})` : ''} — shift #${assignment.shift.id}`;
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
      return 'You do not have permission to view chore plan change history.';
    }
  }
  return 'Could not load chore plan change history. Please try again.';
}

function ChangeHistoryEntry({ entry }: { entry: ChorePlanChangeHistoryEntry }) {
  const reason = entryReason(entry);
  const assignments = affectedAssignments(entry);
  return (
    <Box>
      <Typography fontWeight={600}>{changeHistoryEntryTitle(entry)}</Typography>
      <Typography>{changeHistoryEntryDescription(entry)}</Typography>
      <Typography color="text.secondary" variant="body2">
        {entry.actor.name} · {DATE_FORMATTER.format(new Date(entry.createdAt))}
      </Typography>
      {entry.action === 'admin_assignment_mutated' && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          <Chip
            label={`Operation: ${operationLabel(entry.details.operation)}`}
            size="small"
            variant="outlined"
          />
          <Chip
            color={entry.details.forced ? 'warning' : 'default'}
            label={`Forced: ${entry.details.forced ? 'yes' : 'no'}`}
            size="small"
          />
        </Stack>
      )}
      {reason && (
        <Typography sx={{ mt: 1 }} variant="body2">
          <strong>Reason:</strong> {reason}
        </Typography>
      )}
      {(entry.action === 'participant_requirements_overridden' ||
        entry.action === 'participant_requirements_cleared') &&
        entry.details.previousReason && (
          <Typography color="text.secondary" variant="body2">
            Previous override reason: {entry.details.previousReason}
          </Typography>
        )}
      {assignments.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography component="h4" fontWeight={600} variant="body2">
            Affected assignments
          </Typography>
          <Box component="ul" sx={{ my: 0.5, pl: 3 }}>
            {assignments.map((assignment) => (
              <Typography
                component="li"
                key={`${assignment.action}:${assignment.participant.id}:${assignment.shift.id}`}
                variant="body2"
              >
                {assignmentLabel(assignment)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
      {entry.action === 'admin_assignment_mutated' &&
        entry.details.bypassedRules.length > 0 && (
          <Typography sx={{ mt: 1 }} variant="body2">
            <strong>Bypassed rules:</strong>{' '}
            {entry.details.bypassedRules.join(', ')}
          </Typography>
        )}
    </Box>
  );
}

export default function ChorePlanChangeHistoryDialog({
  client = defaultClient,
  onClose,
  open,
  rosterID,
  rosterYear,
}: ChorePlanChangeHistoryDialogProps) {
  const requestID = useRef(0);
  const [history, setHistory] = useState<ChorePlanChangeHistoryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const currentRequestID = requestID.current + 1;
    requestID.current = currentRequestID;
    setLoading(true);
    setError(null);
    try {
      const response = await client.GetChangeHistory(rosterID);
      if (requestID.current === currentRequestID) {
        setHistory(response);
      }
    } catch (loadError) {
      if (requestID.current === currentRequestID) {
        setHistory(null);
        setError(errorMessage(loadError));
      }
    } finally {
      if (requestID.current === currentRequestID) {
        setLoading(false);
      }
    }
  }, [client, rosterID]);

  useEffect(() => {
    if (open) {
      loadHistory();
      return undefined;
    }
    requestID.current += 1;
    return undefined;
  }, [loadHistory, open]);

  return (
    <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
      <DialogTitle>Change history</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Administrative changes to the {rosterYear} chore plan, newest first.
        </DialogContentText>
        {loading && (
          <Stack alignItems="center" direction="row" spacing={1}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">
              Loading change history…
            </Typography>
          </Stack>
        )}
        {!loading && error && (
          <Alert
            action={
              <Button color="inherit" onClick={loadHistory} size="small">
                Retry
              </Button>
            }
            severity="error"
          >
            {error}
          </Alert>
        )}
        {!loading && !error && history?.entries.length === 0 && (
          <Typography color="text.secondary">
            No administrative changes have been recorded yet.
          </Typography>
        )}
        {!loading && !error && history && history.entries.length > 0 && (
          <Stack divider={<Divider flexItem />} spacing={2}>
            {history.entries.map((entry) => (
              <ChangeHistoryEntry entry={entry} key={entry.id} />
            ))}
          </Stack>
        )}
        {!loading && !error && history?.hasMore && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Showing the 100 newest changes.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

ChorePlanChangeHistoryDialog.defaultProps = {
  client: defaultClient,
};
