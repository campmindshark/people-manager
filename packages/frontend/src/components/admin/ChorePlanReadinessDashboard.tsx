import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CHORE_PLAN_KINDS, ChorePlanKind } from 'backend/domain/chore_planning';
import {
  ChorePlanReadinessResponse,
  ChorePlanReadinessShift,
} from 'backend/view_models/chore_plan_readiness';
import { BM_TIMEZONE } from 'backend/utils/burnDates';

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Chores',
  event: 'Events',
  dinner: 'Dinners',
};

const DATA_ISSUE_LABELS = {
  public_profile: 'public profile',
  private_profile: 'private profile',
  attendance_window: 'attendance window',
};

const SHIFT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BM_TIMEZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function ShiftGroup({
  label,
  shifts,
  color,
}: {
  label: string;
  shifts: ChorePlanReadinessShift[];
  color: 'success' | 'warning' | 'error';
}) {
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>{label}</Typography>
          <Chip label={shifts.length} size="small" color={color} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {shifts.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            None
          </Typography>
        ) : (
          <List dense disablePadding>
            {shifts.map((shift) => (
              <ListItem key={shift.shiftID} disableGutters>
                <ListItemText
                  primary={`${shift.scheduleName} · ${SHIFT_TIME_FORMATTER.format(
                    new Date(shift.startTime),
                  )}`}
                  secondary={`${shift.assignedParticipants} of ${shift.requiredParticipants} spots filled`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export function ChorePlanReadinessDashboard({
  readiness,
}: {
  readiness: ChorePlanReadinessResponse;
}) {
  const exemptions = readiness.requirementExceptions.filter(
    ({ type }) => type === 'exemption',
  );
  const overrides = readiness.requirementExceptions.filter(
    ({ type }) => type === 'override',
  );
  const headcountMatches = readiness.headcountDifference === 0;

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5">Admin readiness</Typography>
          <Typography color="text.secondary">
            Live signup coverage, capacity, feasibility, and participant data.
          </Typography>
        </Box>

        <Alert severity={headcountMatches ? 'success' : 'warning'}>
          Planner headcount: <strong>{readiness.plannerHeadcount}</strong> ·
          Actual roster: <strong>{readiness.actualRosterCount}</strong>
          {!headcountMatches && (
            <>
              {' '}
              · The roster is{' '}
              <strong>{Math.abs(readiness.headcountDifference)}</strong>{' '}
              {readiness.headcountDifference > 0 ? 'over' : 'under'} the plan.
            </>
          )}
        </Alert>

        <Grid container spacing={2}>
          {CHORE_PLAN_KINDS.map((kind) => {
            const category = readiness.categories[kind];
            return (
              <Grid item xs={12} md={4} key={kind}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography color="text.secondary">
                    {CATEGORY_LABELS[kind]}
                  </Typography>
                  <Typography variant="h5">
                    {category.completeParticipants} complete ·{' '}
                    {category.incompleteParticipants} incomplete
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {category.assignedShifts} of {category.requiredShifts}{' '}
                    required participant assignments
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Box>
          <Typography variant="h6" gutterBottom>
            Shift capacity
          </Typography>
          <ShiftGroup
            label="Underfilled shifts"
            shifts={readiness.underfilledShifts}
            color="warning"
          />
          <ShiftGroup
            label="Full shifts"
            shifts={readiness.fullShifts}
            color="success"
          />
          <ShiftGroup
            label="Overfilled shifts"
            shifts={readiness.overfilledShifts}
            color="error"
          />
        </Box>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Incomplete participants</Typography>
              <Chip
                label={readiness.incompleteParticipants.length}
                size="small"
                color={
                  readiness.incompleteParticipants.length
                    ? 'warning'
                    : 'success'
                }
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {readiness.incompleteParticipants.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                Every roster participant has met their requirements.
              </Typography>
            ) : (
              <List dense disablePadding>
                {readiness.incompleteParticipants.map((participant) => (
                  <ListItem key={participant.userID} disableGutters>
                    <ListItemText
                      primary={participant.name}
                      secondary={CHORE_PLAN_KINDS.flatMap((kind) => {
                        const count = participant.missing[kind];
                        return count
                          ? [
                              `${count} ${kind} shift${
                                count === 1 ? '' : 's'
                              } missing`,
                            ]
                          : [];
                      }).join(' · ')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>

        <Box>
          <Typography variant="h6" gutterBottom>
            Participants with no feasible choices
          </Typography>
          {readiness.feasibilityIssues.length === 0 ? (
            <Alert severity="success">
              Every incomplete category has at least one feasible open choice.
            </Alert>
          ) : (
            <Alert severity="error">
              <List dense disablePadding>
                {readiness.feasibilityIssues.map((issue) => (
                  <ListItem
                    key={`${issue.userID}-${issue.kind}`}
                    disableGutters
                  >
                    <ListItemText
                      primary={`${issue.name} · ${CATEGORY_LABELS[issue.kind]}`}
                      secondary={issue.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            Participant data issues
          </Typography>
          {readiness.participantDataIssues.length === 0 ? (
            <Alert severity="success">
              Every participant has complete profiles and an attendance window.
            </Alert>
          ) : (
            <Alert severity="warning">
              <List dense disablePadding>
                {readiness.participantDataIssues.map((issue) => (
                  <ListItem key={issue.userID} disableGutters>
                    <ListItemText
                      primary={issue.name}
                      secondary={`Missing or incomplete: ${issue.missing
                        .map((item) => DATA_ISSUE_LABELS[item])
                        .join(', ')}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            Requirement exceptions
          </Typography>
          {readiness.requirementExceptions.length === 0 ? (
            <Alert severity="success">No requirement exceptions.</Alert>
          ) : (
            <Grid container spacing={2}>
              {[
                { label: 'Exemptions', entries: exemptions },
                { label: 'Overrides', entries: overrides },
              ].map(({ label, entries }) => (
                <Grid item xs={12} md={6} key={label}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1">
                      {label} ({entries.length})
                    </Typography>
                    <List dense disablePadding>
                      {entries.map((entry) => (
                        <ListItem key={entry.userID} disableGutters>
                          <ListItemText
                            primary={entry.name}
                            secondary={`${entry.requirements.chore} chore · ${entry.requirements.event} event · ${entry.requirements.dinner} dinner — ${entry.reason}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export function ChorePlanReadinessReviewDialog({
  open,
  action,
  readiness,
  loading,
  error,
  confirming,
  onClose,
  onConfirm,
  onRetry,
}: {
  open: boolean;
  action: 'open' | 'close';
  readiness: ChorePlanReadinessResponse | null;
  loading: boolean;
  error: string | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const confirmLifecycleChange = () => {
    onClose();
    onConfirm();
  };

  return (
    <Dialog
      open={open}
      onClose={confirming ? undefined : onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        Readiness before {action === 'open' ? 'opening' : 'closing'}
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Stack alignItems="center" sx={{ py: 6 }} spacing={1}>
            <CircularProgress />
            <Typography color="text.secondary">
              Refreshing readiness…
            </Typography>
          </Stack>
        )}
        {!loading && error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!loading && !error && readiness && (
          <ChorePlanReadinessDashboard readiness={readiness} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={action === 'close' ? 'warning' : 'primary'}
          disabled={loading || Boolean(error) || !readiness || confirming}
          onClick={confirmLifecycleChange}
        >
          {confirming
            ? `${action === 'open' ? 'Opening' : 'Closing'}…`
            : `Confirm ${action}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChorePlanReadinessReviewDialog;
