import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrintIcon from '@mui/icons-material/Print';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import User from 'backend/models/user/user';
import { BM_TIMEZONE } from 'backend/utils/burnDates';
import { ChorePlanKind } from 'backend/view_models/chore_plan';
import ShiftViewModel from 'backend/view_models/shift';
import { DateTime } from 'luxon';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';
import './FinalAssignmentsView.css';

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};

const CATEGORY_ORDER: ChorePlanKind[] = ['chore', 'event', 'dinner'];

export interface FinalAssignmentShift extends SignupSheetShift {
  kind: ChorePlanKind;
  shiftViewModel: ShiftViewModel;
}

export interface FinalAssignmentDay {
  key: string;
  weekday: string;
  date: string;
  timestamp: number;
  shifts: FinalAssignmentShift[];
}

export function assignmentsAreFinal(shifts: FinalAssignmentShift[]): boolean {
  return (
    shifts.length > 0 &&
    shifts.every((shift) => shift.shiftViewModel.chorePlanStatus === 'closed')
  );
}

function shiftDateTime(value: Date): DateTime {
  return DateTime.fromJSDate(new Date(value)).setZone(BM_TIMEZONE);
}

function participantName(participant: User): string {
  return participant instanceof User
    ? participant.shiftSignupName()
    : User.fromJson(participant).shiftSignupName();
}

export function assignmentDays(
  shifts: FinalAssignmentShift[],
): FinalAssignmentDay[] {
  const daysByDate = new Map<string, FinalAssignmentDay>();

  shifts.forEach((shift) => {
    const start = shiftDateTime(shift.shiftViewModel.shift.startTime);
    const key = start.toISODate() ?? '';
    const day = daysByDate.get(key) ?? {
      key,
      weekday: start.toFormat('cccc'),
      date: start.toFormat('LLL d'),
      timestamp: start.startOf('day').toMillis(),
      shifts: [],
    };
    day.shifts.push(shift);
    daysByDate.set(key, day);
  });

  return [...daysByDate.values()]
    .sort((first, second) => first.timestamp - second.timestamp)
    .map((day) => ({
      ...day,
      shifts: [...day.shifts].sort((first, second) => {
        const firstStart = new Date(
          first.shiftViewModel.shift.startTime,
        ).getTime();
        const secondStart = new Date(
          second.shiftViewModel.shift.startTime,
        ).getTime();
        return (
          firstStart - secondStart ||
          CATEGORY_ORDER.indexOf(first.kind) -
            CATEGORY_ORDER.indexOf(second.kind) ||
          first.scheduleName.localeCompare(second.scheduleName)
        );
      }),
    }));
}

export function assignmentTime(shift: FinalAssignmentShift): string {
  const start = shiftDateTime(shift.shiftViewModel.shift.startTime);
  const end = shiftDateTime(shift.shiftViewModel.shift.endTime);
  const endDay = end.toISODate() === start.toISODate() ? '' : ' next day';
  return `${start.toFormat('h:mm a')}–${end.toFormat('h:mm a')}${endDay}`;
}

function FinalAssignmentSlots({
  shift,
  currentUserID,
}: {
  shift: FinalAssignmentShift;
  currentUserID: number;
}) {
  const participants = [...shift.shiftViewModel.participants].sort((a, b) =>
    participantName(a).localeCompare(participantName(b)),
  );

  if (!participants.length) {
    return null;
  }

  return (
    <div className="signup-sheet-slots">
      {participants.map((participant) => {
        const currentUser = Number(participant.id) === Number(currentUserID);
        return (
          <span
            className={`signup-sheet-slot filled ${
              currentUser ? 'current-user' : ''
            }`}
            key={`${shift.key}|assignment-${participant.id}`}
          >
            {participantName(participant)}
            {currentUser ? (
              <span className="final-assignment-current-user-label">
                {' '}
                (you)
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default function FinalAssignmentsView({
  shifts,
  rosterYear,
  currentUserID,
}: {
  shifts: FinalAssignmentShift[];
  rosterYear: number;
  currentUserID: number;
}) {
  const assignmentCount = shifts.reduce(
    (total, shift) => total + shift.shiftViewModel.participants.length,
    0,
  );

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
              {assignmentCount} assignments
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

        <Paper className="final-assignments-print-root" variant="outlined">
          <header className="final-assignments-print-header">
            <Typography component="h1" variant="h4">
              {rosterYear} final assignments
            </Typography>
            <Typography color="text.secondary" variant="body2">
              All dates and times are shown in Pacific Time · {assignmentCount}{' '}
              assignments
            </Typography>
          </header>

          <Stack className="final-assignment-categories" spacing={2}>
            {CATEGORY_ORDER.map((kind) => {
              const categoryShifts = shifts.filter(
                (shift) => shift.kind === kind,
              );

              return (
                <Accordion
                  className="final-assignment-category-section"
                  defaultExpanded
                  key={kind}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={{ xs: 0.5, sm: 2 }}
                    >
                      <Typography component="h2" variant="h6">
                        {CATEGORY_LABELS[kind]}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: { xs: 0, sm: 2 } }}>
                    {categoryShifts.length ? (
                      <SignupSheetTable
                        emptyCellContent={null}
                        kind={kind}
                        shifts={categoryShifts}
                        renderShift={(shift) => (
                          <FinalAssignmentSlots
                            currentUserID={currentUserID}
                            shift={shift}
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
    </>
  );
}
