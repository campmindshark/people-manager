import React from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ChorePlanAuditEntry from 'backend/view_models/chore_plan_audit';
import { ChorePlanRequirements } from 'backend/view_models/chore_plan';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function requirementsLabel(requirements: ChorePlanRequirements): string {
  return `${requirements.chore} chore, ${requirements.event} event, ${requirements.dinner} dinner`;
}

export function auditEntryDescription(entry: ChorePlanAuditEntry): string {
  const { action, details } = entry;
  switch (action) {
    case 'plan_created':
      return `Created the ${
        details.camperCount ?? 0
      }-camper chore plan with ${plural(
        details.slotCount ?? 0,
        'signup spot',
      )}.`;
    case 'plan_updated': {
      const changes: string[] = [];
      if (
        details.previousCamperCount !== undefined &&
        details.camperCount !== undefined &&
        details.previousCamperCount !== details.camperCount
      ) {
        changes.push(
          `camper count ${details.previousCamperCount} → ${details.camperCount}`,
        );
      }
      if (
        details.previousRequirements &&
        details.requirements &&
        requirementsLabel(details.previousRequirements) !==
          requirementsLabel(details.requirements)
      ) {
        changes.push(
          `requirements ${requirementsLabel(
            details.previousRequirements,
          )} → ${requirementsLabel(details.requirements)}`,
        );
      }
      if (details.addedSlots) {
        changes.push(`added ${plural(details.addedSlots, 'signup spot')}`);
      }
      if (details.createdShifts) {
        changes.push(`created ${plural(details.createdShifts, 'shift')}`);
      }
      if (details.createdSchedules) {
        changes.push(`created ${plural(details.createdSchedules, 'schedule')}`);
      }
      if (
        details.previousSheetTitle &&
        details.sheetTitle &&
        details.previousSheetTitle !== details.sheetTitle
      ) {
        changes.push(
          `score sheet “${details.previousSheetTitle}” → “${details.sheetTitle}”`,
        );
      }
      return changes.length
        ? `Updated the chore plan: ${changes.join(', ')}.`
        : 'Updated the chore plan.';
    }
    case 'signups_opened':
      return 'Opened chore signups.';
    case 'signups_closed':
      return 'Closed chore signups.';
    case 'shift_participant_assigned': {
      const { assignment } = details;
      return assignment
        ? `Assigned ${assignment.userName} to ${assignment.destinationShift.scheduleName}.`
        : 'Assigned a chore shift participant.';
    }
    case 'shift_participants_reassigned': {
      const reassignments = details.reassignments ?? [];
      const actionLabel = details.forced ? 'Force-moved' : 'Moved';
      if (reassignments.length === 1) {
        const [reassignment] = reassignments;
        return `${actionLabel} ${reassignment.userName} from ${reassignment.sourceShift.scheduleName} to ${reassignment.destinationShift.scheduleName}.`;
      }
      if (reassignments.length === 2) {
        return `${details.forced ? 'Force-swapped' : 'Swapped'} ${
          reassignments[0].userName
        } and ${reassignments[1].userName} between their shifts.`;
      }
      return `${actionLabel} chore shift assignments.`;
    }
    case 'shift_participant_unassigned': {
      const { unassignment } = details;
      return unassignment
        ? `Unassigned ${unassignment.userName} from ${unassignment.sourceShift.scheduleName}.`
        : 'Unassigned a chore shift participant.';
    }
    case 'participant_requirements_updated':
      return `Set ${
        details.participantName ?? 'a participant'
      }'s requirements to ${
        details.requirements
          ? requirementsLabel(details.requirements)
          : 'custom values'
      }${details.reason ? ` (${details.reason})` : ''}.`;
    case 'participant_requirements_reset':
      return `Reset ${
        details.participantName ?? 'a participant'
      }'s requirements to the plan defaults.`;
    default:
      return 'Changed the chore plan.';
  }
}

export default function ChorePlanAuditLog({
  entries,
  loading,
}: {
  entries: ChorePlanAuditEntry[];
  loading: boolean;
}) {
  let content: React.ReactNode;
  if (loading) {
    content = (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={18} />
        <Typography color="text.secondary">Loading change history…</Typography>
      </Stack>
    );
  } else if (entries.length === 0) {
    content = (
      <Typography color="text.secondary">
        No administrative changes have been recorded yet.
      </Typography>
    );
  } else {
    content = (
      <Stack divider={<Divider flexItem />} spacing={2}>
        {entries.map((entry) => (
          <Box key={entry.id}>
            <Typography>{auditEntryDescription(entry)}</Typography>
            <Typography color="text.secondary" variant="body2">
              {entry.actor.name} ·{' '}
              {DATE_FORMATTER.format(new Date(entry.createdAt))}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Change history
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Administrative changes to this roster&apos;s chore schedules, newest
        first.
      </Typography>
      {content}
    </Paper>
  );
}
