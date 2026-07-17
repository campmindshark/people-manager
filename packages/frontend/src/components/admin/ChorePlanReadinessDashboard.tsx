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
import {
  CHORE_PLAN_KINDS,
  ChorePlanKind,
  ChorePlanReadiness,
  ChorePlanReadinessShift,
} from 'backend/view_models/chore_plan';

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Chores',
  event: 'Events',
  dinner: 'Dinners',
};

function formatShiftTime(startTime: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startTime));
}

function ShiftGroup({
  label,
  shifts,
  color,
}: {
  label: string;
  shifts: ChorePlanReadinessShift[];
  color: 'default' | 'success' | 'warning' | 'error';
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
                  primary={`${shift.scheduleName} · ${formatShiftTime(
                    shift.startTime,
                  )}`}
                  secondary={`${shift.participantCount} of ${shift.requiredParticipants} spots filled`}
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
  readiness: ChorePlanReadiness;
}) {
  const exemptions = readiness.requirementExceptions.filter(
    (exception) => exception.type === 'exemption',
  );
  const overrides = readiness.requirementExceptions.filter(
    (exception) => exception.type === 'override',
  );
  const headcountMatches = readiness.headcountDifference === 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5">Admin readiness</Typography>
          <Typography color="text.secondary">
            Live signup coverage, capacity, feasibility, and exceptions.
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
                    {category.completeMembers} complete ·{' '}
                    {category.incompleteMembers} incomplete
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {category.assignedSpots} of {category.requiredSpots}{' '}
                    required member assignments
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
              <Typography>Incomplete members</Typography>
              <Chip
                label={readiness.incompleteMembers.length}
                size="small"
                color={
                  readiness.incompleteMembers.length ? 'warning' : 'success'
                }
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {readiness.incompleteMembers.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                Every roster member has met their requirements.
              </Typography>
            ) : (
              <List dense disablePadding>
                {readiness.incompleteMembers.map((member) => (
                  <ListItem key={member.userID} disableGutters>
                    <ListItemText
                      primary={member.name}
                      secondary={CHORE_PLAN_KINDS.flatMap((kind) => {
                        const count = member.missing[kind];
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
            Members with no feasible choices
          </Typography>
          {readiness.noFeasibleChoices.length === 0 ? (
            <Alert severity="success">
              Every incomplete category has at least one feasible open choice.
            </Alert>
          ) : (
            <Alert severity="error">
              <List dense disablePadding>
                {readiness.noFeasibleChoices.map((member) => (
                  <ListItem
                    key={`${member.userID}-${member.kind}`}
                    disableGutters
                  >
                    <ListItemText
                      primary={`${member.name} · ${
                        CATEGORY_LABELS[member.kind]
                      }`}
                      secondary={member.reason}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            Exemptions and overrides
          </Typography>
          {readiness.requirementExceptions.length === 0 ? (
            <Alert severity="success">
              No member requirement exemptions or overrides.
            </Alert>
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
                    {entries.length === 0 ? (
                      <Typography color="text.secondary" variant="body2">
                        None
                      </Typography>
                    ) : (
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
                    )}
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
  readiness: ChorePlanReadiness | null;
  loading: boolean;
  error: string | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const handleConfirm = () => {
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
          onClick={handleConfirm}
        >
          {confirming
            ? `${action === 'open' ? 'Opening' : 'Closing'}…`
            : `Confirm ${action}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
