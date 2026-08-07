import React from 'react';
import PrintIcon from '@mui/icons-material/Print';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ChorePlanKind } from 'backend/domain/chore_planning';
import {
  ChorePlanFinalAssignmentShift,
  ChorePlanFinalAssignmentsResponse,
} from 'backend/view_models/chore_plan_final_assignments';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';
import './FinalAssignmentsView.css';

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};

interface FinalAssignmentGridShift extends SignupSheetShift {
  shift: ChorePlanFinalAssignmentShift;
}

function gridShift(
  shift: ChorePlanFinalAssignmentShift,
): FinalAssignmentGridShift {
  return {
    key: shift.stableKey,
    scheduleName: shift.scheduleName,
    day: shift.displayDayNumber,
    timePeriod: shift.timePeriodLabel,
    periodOrder: shift.periodOrder ?? 0,
    shift,
  };
}

function FinalAssignmentNames({
  shift,
}: {
  shift: ChorePlanFinalAssignmentShift;
}) {
  if (shift.participants.length === 0) {
    return null;
  }

  const nameOccurrences = new Map<string, number>();

  return (
    <div className="signup-sheet-slots">
      {shift.participants.map((participant) => {
        const occurrence =
          (nameOccurrences.get(participant.displayName) ?? 0) + 1;
        nameOccurrences.set(participant.displayName, occurrence);
        return (
          <span
            className={`signup-sheet-slot filled ${
              participant.currentUser ? 'current-user' : ''
            }`}
            key={`${shift.stableKey}|${participant.displayName}|${occurrence}`}
          >
            {participant.displayName}
            {participant.currentUser && (
              <span className="final-assignment-current-user-label">
                {' '}
                (you)
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function FinalAssignmentsView({
  assignments,
}: {
  assignments: ChorePlanFinalAssignmentsResponse;
}) {
  return (
    <>
      <style media="print">
        {'@page { size: landscape; margin: 0.35in; }'}
      </style>
      <Stack spacing={2}>
        <Stack
          alignItems={{ xs: 'stretch', sm: 'center' }}
          className="final-assignments-screen-header"
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h5">Assignment sheets</Typography>
            <Typography color="text.secondary" variant="body2">
              {assignments.assignmentCount}{' '}
              {assignments.assignmentCount === 1 ? 'assignment' : 'assignments'}
            </Typography>
          </Box>
          <Button
            onClick={() => window.print()}
            startIcon={<PrintIcon />}
            variant="contained"
          >
            Print assignments
          </Button>
        </Stack>

        {assignments.assignmentCount === 0 && (
          <Alert severity="info" className="final-assignments-empty-alert">
            No participant assignments were recorded when the plan closed.
          </Alert>
        )}

        <Paper className="final-assignments-print-root" variant="outlined">
          <header className="final-assignments-print-header">
            <Typography component="h1" variant="h4">
              {assignments.planningYear} final assignments
            </Typography>
            <Typography color="text.secondary" variant="body2">
              All dates and times are shown in Pacific Time ·{' '}
              {assignments.assignmentCount}{' '}
              {assignments.assignmentCount === 1 ? 'assignment' : 'assignments'}
            </Typography>
          </header>

          <Stack className="final-assignment-categories" spacing={2}>
            {assignments.categories.map((category) => {
              const shifts = category.shifts.map(gridShift);
              return (
                <Paper
                  className="final-assignment-category-section"
                  component="section"
                  key={category.kind}
                  variant="outlined"
                >
                  <Typography component="h2" variant="h6" sx={{ p: 2 }}>
                    {CATEGORY_LABELS[category.kind]}
                  </Typography>
                  {shifts.length > 0 ? (
                    <SignupSheetTable
                      emptyCellContent={null}
                      kind={category.kind}
                      shifts={shifts}
                      renderShift={({ shift }) => (
                        <FinalAssignmentNames shift={shift} />
                      )}
                    />
                  ) : (
                    <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
                      No {CATEGORY_LABELS[category.kind].toLowerCase()} were
                      generated.
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      </Stack>
    </>
  );
}
