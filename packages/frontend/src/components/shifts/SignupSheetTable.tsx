import React from 'react';
import Paper from '@mui/material/Paper';
import { alpha, styled } from '@mui/material/styles';
import { ChoreCatalogKind } from 'backend/view_models/chore_catalog';
import './SignupSheetTable.css';

export interface SignupSheetShift {
  key: string;
  scheduleName: string;
  day: number;
  timePeriod: string;
  periodOrder: number;
}

interface SignupSheetTableProps<ShiftType extends SignupSheetShift> {
  kind: ChoreCatalogKind;
  shifts: ShiftType[];
  renderShift: (shift: ShiftType) => React.ReactNode;
  emptyCellContent: React.ReactNode;
}

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const DAYS = DAY_LABELS.length;
// The catalog's zero-score 3a-6a period is deliberately omitted to preserve
// PR #58's canonical five-period signup sheet.
const EVENT_PERIODS = [
  { key: '12p-3p', label: '12 pm - 3 pm' },
  { key: '3p-6p', label: '3 pm - 6 pm' },
  { key: '6p-9p', label: '6 pm - 9 pm' },
  { key: '9p-12a', label: '9 pm - 12 am' },
  { key: '12a-3a', label: '12 am - 3 am' },
] as const;
const EVENT_PERIOD_KEYS = new Set<string>(EVENT_PERIODS.map(({ key }) => key));

const SignupSheetShell = styled(Paper)(({ theme }) => ({
  '--signup-sheet-divider': theme.palette.divider,
  '--signup-sheet-header-background': theme.palette.action.hover,
  '--signup-sheet-row-background': alpha(theme.palette.text.primary, 0.025),
  '--signup-sheet-row-hover-background': theme.palette.action.hover,
  '--signup-sheet-sticky-background': theme.palette.background.paper,
  '--signup-sheet-sticky-secondary-background': alpha(
    theme.palette.text.primary,
    0.045,
  ),
  '--signup-sheet-text': theme.palette.text.primary,
  '--signup-sheet-muted-text': theme.palette.text.secondary,
  '--signup-sheet-accent': theme.palette.primary.light,
  '--signup-sheet-high': theme.palette.success.main,
  '--signup-sheet-high-background': alpha(theme.palette.success.main, 0.16),
  '--signup-sheet-other-user': theme.palette.text.disabled,
  '--signup-sheet-other-user-background': alpha(
    theme.palette.text.primary,
    0.12,
  ),
  '--signup-sheet-medium': theme.palette.warning.main,
  '--signup-sheet-medium-background': alpha(theme.palette.warning.main, 0.16),
  '--signup-sheet-low': theme.palette.error.main,
  '--signup-sheet-low-background': alpha(theme.palette.error.main, 0.16),
  '--signup-sheet-removal-hatch': alpha(theme.palette.error.main, 0.42),
  '--signup-sheet-admin-selection-background': alpha(
    theme.palette.secondary.main,
    0.16,
  ),
  '--signup-sheet-admin-selection': theme.palette.secondary.main,
}));

function eventPeriodKey(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{1,2})\s*([ap])(?:m)?\s*-\s*(\d{1,2})\s*([ap])(?:m)?$/i);
  if (!match) {
    return value.trim().toLowerCase();
  }
  return `${Number(match[1])}${match[2].toLowerCase()}-${Number(match[3])}${match[4].toLowerCase()}`;
}

function parseClockTime(value: string): { label: string; minutes: number } {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!match) {
    return {
      label: value || 'Any time',
      minutes: Number.POSITIVE_INFINITY,
    };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const marker = match[3].toUpperCase();
  const minutes = (hour % 12) * 60 + minute + (marker === 'PM' ? 12 * 60 : 0);
  const label =
    minute === 0 ? `${hour} ${marker}` : `${hour}:${match[2]} ${marker}`;
  return { label, minutes };
}

function ChoreScheduleTable<ShiftType extends SignupSheetShift>({
  shifts,
  dinner,
  renderShift,
  emptyCellContent,
}: {
  shifts: ShiftType[];
  dinner: boolean;
  renderShift: (shift: ShiftType) => React.ReactNode;
  emptyCellContent: React.ReactNode;
}) {
  const cells = new Map(
    shifts.map((shift) => [`${shift.day}|${shift.scheduleName}`, shift]),
  );
  const columns = [
    ...new Map(
      shifts.map((shift) => [
        shift.scheduleName,
        { shift: shift.scheduleName, timePeriod: shift.timePeriod },
      ]),
    ).values(),
  ].sort(
    (first, second) =>
      parseClockTime(first.timePeriod).minutes -
      parseClockTime(second.timePeriod).minutes,
  );

  return (
    <SignupSheetShell
      className="signup-sheet-table-shell signup-sheet-chore-grid-shell"
      variant="outlined"
    >
      <table
        className={`signup-sheet-grid signup-sheet-chore-grid ${
          dinner ? 'signup-sheet-dinner-grid' : ''
        }`}
      >
        <thead>
          <tr>
            <th className="signup-sheet-chore-day-heading" scope="col">
              Day
            </th>
            {columns.map((column) => (
              <th scope="col" key={column.shift}>
                <span className="signup-sheet-chore-time">
                  {parseClockTime(column.timePeriod).label}
                </span>
                {column.shift}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: DAYS }, (_, index) => index + 1).map((day) => (
            <tr key={day}>
              <th scope="row">
                <span className="signup-sheet-day-label">
                  {DAY_LABELS[day - 1]}
                </span>
              </th>
              {columns.map((column) => {
                const shift = cells.get(`${day}|${column.shift}`);
                return (
                  <td key={column.shift}>
                    {shift ? renderShift(shift) : emptyCellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </SignupSheetShell>
  );
}

function EventScheduleTable<ShiftType extends SignupSheetShift>({
  shifts,
  renderShift,
  emptyCellContent,
}: {
  shifts: ShiftType[];
  renderShift: (shift: ShiftType) => React.ReactNode;
  emptyCellContent: React.ReactNode;
}) {
  const displayedShifts = shifts.filter((shift) =>
    EVENT_PERIOD_KEYS.has(eventPeriodKey(shift.timePeriod)),
  );
  const cells = new Map(
    displayedShifts.map((shift) => [
      `${shift.day}|${eventPeriodKey(shift.timePeriod)}|${shift.scheduleName}`,
      shift,
    ]),
  );
  const eventShiftNames = [
    ...new Map(
      displayedShifts.map((shift) => [shift.scheduleName, shift.scheduleName]),
    ).values(),
  ];

  return (
    <SignupSheetShell
      className="signup-sheet-table-shell signup-sheet-event-grid-shell"
      variant="outlined"
    >
      <table className="signup-sheet-grid signup-sheet-event-grid">
        <thead>
          <tr>
            <th className="signup-sheet-event-day-heading" scope="col">
              Day
            </th>
            <th className="signup-sheet-event-shift-heading" scope="col">
              Shift
            </th>
            {EVENT_PERIODS.map((period) => (
              <th scope="col" key={period.key}>
                {period.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: DAYS }, (_, index) => index + 1).flatMap(
            (day) =>
              eventShiftNames.map((shiftName, shiftIndex) => (
                <tr
                  className={shiftIndex === 0 ? 'signup-sheet-day-start' : ''}
                  key={`${day}|${shiftName}`}
                >
                  {shiftIndex === 0 ? (
                    <th
                      className="signup-sheet-event-day-cell"
                      scope="rowgroup"
                      rowSpan={eventShiftNames.length}
                    >
                      <span className="signup-sheet-day-label">
                        {DAY_LABELS[day - 1]}
                      </span>
                    </th>
                  ) : null}
                  <th className="signup-sheet-event-shift-cell" scope="row">
                    {shiftName}
                  </th>
                  {EVENT_PERIODS.map((period) => {
                    const shift = cells.get(
                      `${day}|${period.key}|${shiftName}`,
                    );
                    return (
                      <td key={period.key}>
                        {shift ? renderShift(shift) : emptyCellContent}
                      </td>
                    );
                  })}
                </tr>
              )),
          )}
        </tbody>
      </table>
    </SignupSheetShell>
  );
}

export default function SignupSheetTable<ShiftType extends SignupSheetShift>({
  kind,
  shifts,
  renderShift,
  emptyCellContent,
}: SignupSheetTableProps<ShiftType>) {
  if (kind === 'event') {
    return (
      <EventScheduleTable
        shifts={shifts}
        renderShift={renderShift}
        emptyCellContent={emptyCellContent}
      />
    );
  }
  return (
    <ChoreScheduleTable
      shifts={shifts}
      dinner={kind === 'dinner'}
      renderShift={renderShift}
      emptyCellContent={emptyCellContent}
    />
  );
}
