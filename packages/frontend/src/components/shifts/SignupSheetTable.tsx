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

function formatTimePeriod(value: string): string {
  const match = value.trim().match(/^(\d{1,2})(a|p)-(\d{1,2})(a|p)$/i);
  if (!match) {
    return value || 'Any time';
  }
  const meridiem = (marker: string) =>
    marker.toLowerCase() === 'a' ? 'AM' : 'PM';
  return `${match[1]} ${meridiem(match[2])} - ${match[3]} ${meridiem(
    match[4],
  )}`;
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
  const cells = new Map(
    shifts.map((shift) => [
      `${shift.day}|${shift.periodOrder}|${shift.timePeriod}|${shift.scheduleName}`,
      shift,
    ]),
  );
  const eventShiftNames = [
    ...new Map(
      shifts.map((shift) => [shift.scheduleName, shift.scheduleName]),
    ).values(),
  ];
  const periods = [
    ...new Map(
      shifts.map((shift) => [
        `${shift.periodOrder}|${shift.timePeriod}`,
        { periodOrder: shift.periodOrder, timePeriod: shift.timePeriod },
      ]),
    ).values(),
  ].sort((first, second) => first.periodOrder - second.periodOrder);

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
            {periods.map((period) => (
              <th
                scope="col"
                key={`${period.periodOrder}|${period.timePeriod}`}
              >
                {formatTimePeriod(period.timePeriod)}
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
                  {periods.map((period) => {
                    const shift = cells.get(
                      `${day}|${period.periodOrder}|${period.timePeriod}|${shiftName}`,
                    );
                    return (
                      <td key={`${period.periodOrder}|${period.timePeriod}`}>
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
