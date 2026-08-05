import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Roster from 'backend/models/roster/roster';
import ChorePlanPreview, {
  CHORE_PLAN_KINDS,
  ChorePlanActorSummary,
  ChorePlanKind,
  ChorePlanReadiness,
  ChorePlanRequirements,
  ChorePlanShiftPreview,
  ChorePlanSummary,
  DEFAULT_CHORE_PLAN_REQUIREMENTS,
} from 'backend/view_models/chore_plan';
import ChorePlanAuditEntry from 'backend/view_models/chore_plan_audit';
import { BM_TIMEZONE } from 'backend/utils/burnDates';
import { useRecoilRefresher_UNSTABLE, useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import CurrentRosterScheduleState from '../state/schedules';
import BackendRosterClient from '../api/roster/roster';
import BackendChorePlanClient from '../api/chorePlans/client';
import { getFrontendConfig } from '../config/config';
import SignupSheetTable from '../components/shifts/SignupSheetTable';
import { ChorePlanReadinessReviewDialog } from '../components/admin/ChorePlanReadinessDashboard';
import ChoreRequirementExceptions from '../components/admin/ChoreRequirementExceptions';
import ChorePlanAuditLog from '../components/admin/ChorePlanAuditLog';

const DEFAULT_SCORE_SHEET =
  'https://docs.google.com/spreadsheets/d/12QBFgX_jb9vdli-txNK4M2nkMt7TZ_FCHtX_gbEG9BM/edit';
const AUTO_PREVIEW_DELAY_MS = 250;
const LIFECYCLE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BM_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const CATEGORY_LABELS: Record<ChorePlanKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const chorePlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);

function requestErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ??
      error.message
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function lifecycleEvent(
  label: string,
  timestamp: string,
  actor: ChorePlanActorSummary | null,
): string {
  const date = LIFECYCLE_DATE_FORMATTER.format(new Date(timestamp));
  return `${label} ${date} by ${actor?.name ?? 'an unknown administrator'}.`;
}

export function PlanSummary({
  plan,
  year,
  loading,
  onToggleSignups,
}: {
  plan: ChorePlanSummary;
  year: number | undefined;
  loading: boolean;
  onToggleSignups: () => void;
}) {
  const signupsOpen = plan.status === 'open';
  const closed = plan.status === 'closed';
  const yearLabel = year ? ` for ${year}` : '';
  let severity: 'success' | 'info' | 'warning' = 'warning';
  let title = `Chore signups are in draft${yearLabel}.`;
  let description =
    'Members cannot join shifts until signups are opened. Plan updates can add capacity while signups are not closed.';
  if (signupsOpen) {
    severity = 'success';
    title = `Chore signups are open${yearLabel}.`;
    description = 'Members can join available shifts.';
  } else if (closed) {
    severity = 'info';
    title = `Chore signups are closed${yearLabel}.`;
    description =
      'Members cannot change their signups while the plan is closed. Reopen signups to allow changes again.';
  }
  return (
    <Alert
      severity={severity}
      sx={{ mb: 3 }}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={loading}
          onClick={onToggleSignups}
        >
          {loading
            ? `${signupsOpen ? 'Closing' : 'Opening'}…`
            : `Review and ${signupsOpen ? 'close' : 'open'} chore signups`}
        </Button>
      }
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2">
        This plan covers {plan.camperCount} campers with {plan.slotCount} signup
        spots across {plan.shiftCount} shifts. The default member requirement is{' '}
        {plan.requirements.chore} chore, {plan.requirements.event} event, and{' '}
        {plan.requirements.dinner} dinner shifts. {description}
      </Typography>
      {plan.openedAt && (
        <Typography variant="caption" display="block">
          {lifecycleEvent('Last opened', plan.openedAt, plan.openedBy)}
        </Typography>
      )}
      {plan.closedAt && (
        <Typography variant="caption" display="block">
          {lifecycleEvent('Last closed', plan.closedAt, plan.closedBy)}
        </Typography>
      )}
    </Alert>
  );
}

function scoreTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) {
    return 'high';
  }
  if (score >= 25) {
    return 'medium';
  }
  return 'low';
}

export function plannedShiftSummary(
  shifts: Pick<ChorePlanShiftPreview, 'requiredParticipants'>[],
): string {
  const shiftCount = shifts.length;
  const spotCount = shifts.reduce(
    (total, shift) => total + shift.requiredParticipants,
    0,
  );
  return `${spotCount} signup ${
    spotCount === 1 ? 'spot' : 'spots'
  } across ${shiftCount} dated ${shiftCount === 1 ? 'shift' : 'shifts'}`;
}

function PositionChips({ shift }: { shift: ChorePlanShiftPreview }) {
  return (
    <div className="signup-sheet-positions">
      {shift.slots.map((slot) => (
        <span
          className={`signup-sheet-position ${scoreTone(slot.score)}`}
          key={`${shift.key}|${slot.position}`}
        >
          {slot.position}
          <small>{slot.score}</small>
        </span>
      ))}
    </div>
  );
}

export default function AdminChorePlanner() {
  const setPageState = useSetRecoilState(PageState);
  const refreshSchedules = useRecoilRefresher_UNSTABLE(
    CurrentRosterScheduleState,
  );
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [rosterID, setRosterID] = useState(0);
  const [camperCount, setCamperCount] = useState(50);
  const [requirements, setRequirements] = useState<ChorePlanRequirements>({
    ...DEFAULT_CHORE_PLAN_REQUIREMENTS,
  });
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SCORE_SHEET);
  const [existingPlan, setExistingPlan] = useState<ChorePlanSummary | null>(
    null,
  );
  const [preview, setPreview] = useState<ChorePlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupStatusLoading, setSignupStatusLoading] = useState(false);
  const [readiness, setReadiness] = useState<ChorePlanReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [readinessReviewOpen, setReadinessReviewOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<ChorePlanAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [message, setMessage] = useState<{
    severity: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadReadiness = useCallback(async () => {
    if (!rosterID) {
      setReadiness(null);
      return;
    }
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      setReadiness(await chorePlanClient.GetReadiness(rosterID));
    } catch (error) {
      setReadinessError(requestErrorMessage(error));
    } finally {
      setReadinessLoading(false);
    }
  }, [rosterID]);

  const loadAuditLog = useCallback(async () => {
    if (!rosterID) {
      setAuditEntries([]);
      return;
    }
    setAuditLoading(true);
    try {
      setAuditEntries(await chorePlanClient.GetAuditLog(rosterID));
    } catch (error) {
      setMessage({ severity: 'error', text: requestErrorMessage(error) });
    } finally {
      setAuditLoading(false);
    }
  }, [rosterID]);

  useEffect(() => {
    setPageState({ title: 'Chore Planner', index: 'admin-chore-planner' });
  }, [setPageState]);

  useEffect(() => {
    rosterClient
      .GetAllRosters()
      .then((loadedRosters) => {
        const sorted = [...loadedRosters].sort((a, b) => b.year - a.year);
        setRosters(sorted);
        setRosterID(sorted[0]?.id ?? 0);
      })
      .catch((error) =>
        setMessage({ severity: 'error', text: requestErrorMessage(error) }),
      );
  }, []);

  useEffect(() => {
    if (!rosterID) {
      setExistingPlan(null);
      setReadiness(null);
      return undefined;
    }
    let active = true;
    setExistingPlan(null);
    setReadiness(null);
    chorePlanClient
      .GetPlan(rosterID)
      .then((plan) => {
        if (!active) {
          return;
        }
        setExistingPlan(plan);
        if (plan) {
          setCamperCount(plan.camperCount);
          setSheetUrl(plan.sheetUrl);
          setRequirements(plan.requirements);
        } else {
          setCamperCount(50);
          setSheetUrl(DEFAULT_SCORE_SHEET);
          setRequirements({ ...DEFAULT_CHORE_PLAN_REQUIREMENTS });
        }
      })
      .catch((error) => {
        if (active) {
          setMessage({ severity: 'error', text: requestErrorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [rosterID]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  useEffect(() => {
    if (!existingPlan) {
      setReadiness(null);
      setReadinessError(null);
      return;
    }
    loadReadiness();
  }, [existingPlan?.id, loadReadiness]);

  const selectedRoster = rosters.find((roster) => roster.id === rosterID);
  const hasShortage = useMemo(
    () =>
      preview
        ? Object.values(preview.categories).some(
            (category) => category.shortage > 0,
          )
        : false,
    [preview],
  );
  const wouldReduce = Boolean(
    existingPlan && camperCount < existingPlan.camperCount,
  );

  useEffect(() => {
    const hasValidCamperCount =
      Number.isInteger(camperCount) && camperCount >= 1 && camperCount <= 200;
    if (
      !preview ||
      (preview.camperCount === camperCount &&
        CHORE_PLAN_KINDS.every(
          (kind) => preview.requirements[kind] === requirements[kind],
        )) ||
      !rosterID ||
      !sheetUrl.trim() ||
      !hasValidCamperCount ||
      wouldReduce
    ) {
      return undefined;
    }

    let active = true;
    const timeoutID = window.setTimeout(async () => {
      setLoading(true);
      setMessage(null);
      try {
        const loadedPreview = await chorePlanClient.Preview({
          rosterID,
          camperCount,
          sheetUrl,
          requirements,
        });
        if (active) {
          setPreview(loadedPreview);
          setExistingPlan(loadedPreview.existingPlan);
        }
      } catch (error) {
        if (active) {
          setPreview(null);
          setMessage({
            severity: 'error',
            text: requestErrorMessage(error),
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, AUTO_PREVIEW_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timeoutID);
      setLoading(false);
    };
  }, [camperCount, preview, requirements, rosterID, sheetUrl, wouldReduce]);

  const invalidatePreview = () => {
    setPreview(null);
    setMessage(null);
  };

  const request = { rosterID, camperCount, sheetUrl, requirements };

  const handleRosterChange = (event: SelectChangeEvent<number>) => {
    setRosterID(Number(event.target.value));
    invalidatePreview();
  };

  const handlePreview = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const loadedPreview = await chorePlanClient.Preview(request);
      setPreview(loadedPreview);
      setExistingPlan(loadedPreview.existingPlan);
    } catch (error) {
      setPreview(null);
      setMessage({ severity: 'error', text: requestErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await chorePlanClient.Generate(request);
      setExistingPlan(result.plan);
      refreshSchedules();
      await Promise.all([loadReadiness(), loadAuditLog()]);
      setMessage({
        severity: 'success',
        text: `${result.addedSlots} planned slots added; ${
          result.createdShifts
        } shifts and ${result.createdSchedules} schedules were newly created. ${
          result.plan.status === 'open'
            ? 'Signups remain open.'
            : 'Review the plan, then open signups here when ready.'
        }`,
      });
    } catch (error) {
      setMessage({ severity: 'error', text: requestErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSignups = async () => {
    if (!existingPlan) {
      return;
    }

    const shouldOpen = existingPlan.status !== 'open';
    setSignupStatusLoading(true);
    setMessage(null);
    try {
      const updatedPlan = shouldOpen
        ? await chorePlanClient.OpenSignups(rosterID)
        : await chorePlanClient.CloseSignups(rosterID);
      setExistingPlan(updatedPlan);
      setPreview((currentPreview) =>
        currentPreview
          ? { ...currentPreview, existingPlan: updatedPlan }
          : currentPreview,
      );
      refreshSchedules();
      await Promise.all([loadReadiness(), loadAuditLog()]);
      setMessage({
        severity: 'success',
        text: `Chore signups are now ${shouldOpen ? 'open' : 'closed'} for ${
          selectedRoster?.year ?? 'this roster'
        }.`,
      });
    } catch (error) {
      setMessage({ severity: 'error', text: requestErrorMessage(error) });
    } finally {
      setSignupStatusLoading(false);
    }
  };

  const handleReviewSignups = () => {
    setReadinessReviewOpen(true);
    loadReadiness();
  };

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              Chore planner
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
              Turn the scored chore workbook into a blank, dated signup plan.
              Preview the mix first, then if it&apos;s ready publish as a signup
              sheet.
            </Typography>
          </Box>

          {message && (
            <Alert severity={message.severity} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
          {existingPlan && (
            <PlanSummary
              plan={existingPlan}
              year={selectedRoster?.year}
              loading={signupStatusLoading}
              onToggleSignups={handleReviewSignups}
            />
          )}

          {rosterID > 0 && (
            <ChorePlanAuditLog entries={auditEntries} loading={auditLoading} />
          )}

          <Paper component="form" onSubmit={handlePreview} sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="flex-start">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="planner-roster-label">Camp year</InputLabel>
                  <Select
                    labelId="planner-roster-label"
                    label="Camp year"
                    value={rosterID || ''}
                    onChange={handleRosterChange}
                  >
                    {rosters.map((roster) => (
                      <MenuItem key={roster.id} value={roster.id}>
                        {roster.year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Prospective campers"
                  inputProps={{ min: 1, max: 200, step: 1 }}
                  value={camperCount}
                  onChange={(event) => {
                    setCamperCount(Number(event.target.value));
                    setMessage(null);
                  }}
                  error={wouldReduce}
                  helperText={
                    wouldReduce
                      ? `The existing plan already covers ${existingPlan?.camperCount} campers.`
                      : `${requirements.chore} chore, ${requirements.event} event, and ${requirements.dinner} dinner slots per camper.`
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="url"
                  label="Public score sheet"
                  value={sheetUrl}
                  onChange={(event) => {
                    setSheetUrl(event.target.value);
                    invalidatePreview();
                  }}
                  helperText="Adjust scores in Google Sheets, then preview again."
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !rosterID || wouldReduce}
                  startIcon={
                    loading ? <CircularProgress size={18} /> : undefined
                  }
                >
                  Preview signup plan
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {preview && (
            <>
              <Grid container spacing={2}>
                {(Object.keys(CATEGORY_LABELS) as ChorePlanKind[]).map(
                  (kind) => {
                    const category = preview.categories[kind];
                    return (
                      <Grid item xs={12} md={4} key={kind}>
                        <Paper sx={{ p: 2, height: '100%' }}>
                          <Typography color="text.secondary">
                            {CATEGORY_LABELS[kind]}
                          </Typography>
                          <Typography variant="h4">
                            {category.selected} / {category.target}
                          </Typography>
                          <Typography
                            color={
                              category.shortage ? 'error.main' : 'success.main'
                            }
                          >
                            {category.shortage
                              ? `${category.shortage} slots missing from the sheet`
                              : 'Capacity ready'}
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  },
                )}
              </Grid>

              <Paper sx={{ p: 3 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Box>
                    <Typography variant="h5">
                      {selectedRoster?.year} signup sheet preview
                    </Typography>
                    <Typography color="text.secondary">
                      {preview.sheetTitle} ·{' '}
                      {plannedShiftSummary(preview.shifts)}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<PlaylistAddCheckIcon />}
                    disabled={
                      loading ||
                      hasShortage ||
                      wouldReduce ||
                      existingPlan?.status === 'closed'
                    }
                    onClick={handleGenerate}
                  >
                    {existingPlan ? 'Apply plan updates' : 'Create signup plan'}
                  </Button>
                </Stack>

                {hasShortage && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Add more scored positions to the Google Sheet before
                    generating this plan.
                  </Alert>
                )}

                {(Object.keys(CATEGORY_LABELS) as ChorePlanKind[]).map(
                  (kind) => {
                    const shifts = preview.shifts.filter(
                      (shift) => shift.kind === kind,
                    );
                    return (
                      <Accordion key={kind} defaultExpanded={kind === 'chore'}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                          >
                            <Typography variant="h6">
                              {CATEGORY_LABELS[kind]}
                            </Typography>
                            <Chip
                              label={plannedShiftSummary(shifts)}
                              size="small"
                            />
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                          <SignupSheetTable
                            emptyCellContent={
                              <span className="signup-sheet-no-slots">
                                No slots
                              </span>
                            }
                            kind={kind}
                            shifts={shifts}
                            renderShift={(shift) => (
                              <PositionChips shift={shift} />
                            )}
                          />
                        </AccordionDetails>
                      </Accordion>
                    );
                  },
                )}
              </Paper>
            </>
          )}

          {existingPlan && (
            <ChoreRequirementExceptions
              plan={existingPlan}
              onChanged={async () => {
                await Promise.all([loadReadiness(), loadAuditLog()]);
              }}
            />
          )}
        </Stack>

        {existingPlan && (
          <ChorePlanReadinessReviewDialog
            open={readinessReviewOpen}
            action={existingPlan.status === 'open' ? 'close' : 'open'}
            readiness={readiness}
            loading={readinessLoading}
            error={readinessError}
            confirming={signupStatusLoading}
            onClose={() => setReadinessReviewOpen(false)}
            onConfirm={handleToggleSignups}
            onRetry={loadReadiness}
          />
        )}
      </Container>
    </Dashboard>
  );
}
