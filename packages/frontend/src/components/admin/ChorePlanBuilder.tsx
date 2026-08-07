import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import Roster from 'backend/models/roster/roster';
import { ChoreCatalogKind } from 'backend/view_models/chore_catalog';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDraftResponse,
  ChorePlanDraftSummary,
  ChorePlanPreview,
  ChorePlanPreviewRequest,
  ChorePlanRequirements,
  ChorePlanShiftPreview,
} from 'backend/view_models/chore_plan_preview';
import BackendChorePlanClient from '../../api/chore_plans/client';
import BackendRosterClient from '../../api/roster/roster';
import { getFrontendConfig } from '../../config/config';
import SignupSheetTable, { SignupSheetShift } from '../shifts/SignupSheetTable';

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const defaultRosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];
const CATEGORY_LABELS: Record<ChoreCatalogKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};
const DEFAULT_REQUIREMENTS: ChorePlanRequirements = {
  chore: 3,
  event: 3,
  dinner: 1,
};

export interface ChorePlannerClient {
  Preview: (request: ChorePlanPreviewRequest) => Promise<ChorePlanPreview>;
  GetDraft: (rosterID: number) => Promise<ChorePlanDraftResponse>;
  Apply: (request: ChorePlanApplyRequest) => Promise<ChorePlanApplyResponse>;
}

export interface ChorePlannerRosterClient {
  GetAllRosters: () => Promise<Roster[]>;
}

interface ChorePlanBuilderProps {
  planClient?: ChorePlannerClient;
  rosterClient?: ChorePlannerRosterClient;
}

interface FormValues {
  rosterID: string;
  camperCount: string;
}

interface SignupSheetPreviewShift extends SignupSheetShift {
  preview: ChorePlanShiftPreview;
}

function responseStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function responseMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { data?: { error?: string } } }).response
      ?.data?.error;
  }
  return undefined;
}

function wholeNumber(
  value: string,
  minimum: number,
  maximum: number,
): number | null {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value.trim())) {
    return null;
  }
  const number = Number(value);
  return number >= minimum && number <= maximum ? number : null;
}

function parseForm(values: FormValues): ChorePlanPreviewRequest | null {
  const rosterID = wholeNumber(values.rosterID, 1, Number.MAX_SAFE_INTEGER);
  const camperCount = wholeNumber(values.camperCount, 1, 200);
  if (rosterID === null || camperCount === null) {
    return null;
  }
  return {
    rosterID,
    camperCount,
    requirements: { ...DEFAULT_REQUIREMENTS },
  };
}

function requirementsMatch(
  first: ChorePlanRequirements,
  second: ChorePlanRequirements,
): boolean {
  return KINDS.every((kind) => first[kind] === second[kind]);
}

function draftMatchesPreview(
  draft: ChorePlanDraftSummary | null,
  preview: ChorePlanPreview | null,
): boolean {
  return Boolean(
    draft &&
    preview &&
    draft.rosterID === preview.rosterID &&
    draft.planningYear === preview.year &&
    draft.camperCount === preview.camperCount &&
    draft.catalogRevision === preview.catalogRevision &&
    requirementsMatch(draft.requirements, preview.requirements),
  );
}

function previewErrorMessage(error: unknown): string {
  const status = responseStatus(error);
  if (status === 400) {
    return responseMessage(error) ?? 'Check the planning inputs and try again.';
  }
  if (status === 403) {
    return 'You do not have permission to preview chore plans.';
  }
  if (status === 404) {
    return 'Chore planning is unavailable or the selected roster no longer exists.';
  }
  return 'Failed to preview the chore plan. Please try again.';
}

function applyErrorMessage(error: unknown): string {
  const status = responseStatus(error);
  const message = responseMessage(error);
  if (status === 409 && /catalog/i.test(message ?? '')) {
    return 'Chore scores changed after this preview. Preview again before applying.';
  }
  if (status === 409) {
    return 'The saved draft changed after this preview. Preview again before replacing it.';
  }
  if (status === 422) {
    return 'The catalog does not contain enough positions for this plan.';
  }
  if (status === 403) {
    return 'You do not have permission to apply chore plan drafts.';
  }
  if (status === 404) {
    return 'Chore planning is unavailable or the selected roster no longer exists.';
  }
  if (status === 400) {
    return message ?? 'Check the planning inputs and try again.';
  }
  return 'Failed to apply the chore plan draft. Please try again.';
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

function PositionChips({ shift }: { shift: ChorePlanShiftPreview }) {
  return (
    <div className="signup-sheet-positions">
      {shift.slots.map((slot) => (
        <span
          className={`signup-sheet-position ${scoreTone(slot.score)}`}
          key={slot.definitionKey}
        >
          {slot.positionLabel}
          <small>{slot.score}</small>
        </span>
      ))}
    </div>
  );
}

function signupSheetShift(
  preview: ChorePlanShiftPreview,
): SignupSheetPreviewShift {
  return {
    key: preview.stableKey,
    scheduleName: preview.scheduleName,
    day: preview.displayDayNumber,
    timePeriod: preview.timePeriodLabel,
    periodOrder: preview.periodOrder ?? 0,
    preview,
  };
}

export default function ChorePlanBuilder({
  planClient = defaultPlanClient,
  rosterClient = defaultRosterClient,
}: ChorePlanBuilderProps) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [values, setValues] = useState<FormValues>({
    rosterID: '',
    camperCount: '50',
  });
  const [preview, setPreview] = useState<ChorePlanPreview | null>(null);
  const [observedDraft, setObservedDraft] =
    useState<ChorePlanDraftSummary | null>(null);
  const [loadingRosters, setLoadingRosters] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rosterClient
      .GetAllRosters()
      .then((response) => {
        if (!active) {
          return;
        }
        const sorted = [...response].sort(
          (first, second) => second.year - first.year || second.id - first.id,
        );
        setRosters(sorted);
        if (sorted[0]) {
          setValues((current) => ({
            ...current,
            rosterID: String(sorted[0].id),
          }));
        } else {
          setError('Create a roster before planning chores.');
        }
      })
      .catch((loadError) => {
        console.error('Failed to load rosters for chore planning:', loadError);
        if (active) {
          setError('Failed to load rosters. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRosters(false);
        }
      });
    return () => {
      active = false;
    };
  }, [rosterClient]);

  const resetGeneratedState = useCallback(() => {
    setPreview(null);
    setObservedDraft(null);
    setError(null);
    setSuccess(null);
  }, []);

  const setField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    resetGeneratedState();
  };

  const handleRosterChange = (event: SelectChangeEvent<string>) => {
    setField('rosterID', event.target.value);
  };

  const handlePreview = async (event: FormEvent) => {
    event.preventDefault();
    const request = parseForm(values);
    if (!request) {
      setError('Choose a camp year and enter 1–200 prospective campers.');
      setSuccess(null);
      return;
    }

    setPreviewing(true);
    setError(null);
    setSuccess(null);
    try {
      const [generated, currentDraft] = await Promise.all([
        planClient.Preview(request),
        planClient.GetDraft(request.rosterID),
      ]);
      setPreview(generated);
      setObservedDraft(currentDraft.draft);
    } catch (previewError) {
      console.error('Failed to preview chore plan:', previewError);
      setPreview(null);
      setObservedDraft(null);
      setError(previewErrorMessage(previewError));
    } finally {
      setPreviewing(false);
    }
  };

  const hasShortage = useMemo(
    () =>
      preview
        ? KINDS.some((kind) => preview.categories[kind].shortage > 0)
        : false,
    [preview],
  );
  const matchesDraft = draftMatchesPreview(observedDraft, preview);
  const replacesDraft = Boolean(observedDraft && preview && !matchesDraft);
  const selectedRoster = rosters.find(
    (roster) => String(roster.id) === values.rosterID,
  );

  const applyPreview = async () => {
    if (!preview || hasShortage) {
      return;
    }
    setApplying(true);
    setConfirmingReplacement(false);
    setError(null);
    setSuccess(null);
    try {
      const response = await planClient.Apply({
        rosterID: preview.rosterID,
        camperCount: preview.camperCount,
        requirements: preview.requirements,
        expectedCatalogRevision: preview.catalogRevision,
        expectedDraftRevision: observedDraft?.draftRevision ?? null,
      });
      setPreview(response.preview);
      setObservedDraft(response.draft);
      if (!response.changed) {
        setSuccess('The saved signup plan already matches this preview.');
      } else if (response.replaced) {
        setSuccess(
          `Applied signup plan updates in draft revision ${response.draft.draftRevision}.`,
        );
      } else {
        setSuccess(
          `Created signup plan draft revision ${response.draft.draftRevision}.`,
        );
      }
    } catch (applyError) {
      console.error('Failed to apply chore plan draft:', applyError);
      if (responseStatus(applyError) === 409) {
        setPreview(null);
        setObservedDraft(null);
      }
      setError(applyErrorMessage(applyError));
    } finally {
      setApplying(false);
    }
  };

  const handleApply = () => {
    if (replacesDraft) {
      setConfirmingReplacement(true);
      return;
    }
    applyPreview();
  };

  let applyButtonLabel = observedDraft
    ? 'Apply plan updates'
    : 'Create signup plan';
  if (applying) {
    applyButtonLabel = 'Applying…';
  }

  if (loadingRosters) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress aria-label="Loading rosters" />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Paper component="form" onSubmit={handlePreview} sx={{ p: 3 }}>
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="planner-roster-label">Camp year</InputLabel>
              <Select
                labelId="planner-roster-label"
                label="Camp year"
                value={values.rosterID}
                onChange={handleRosterChange}
              >
                {rosters.map((roster) => (
                  <MenuItem key={roster.id} value={String(roster.id)}>
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
              value={values.camperCount}
              onChange={(event) => setField('camperCount', event.target.value)}
              helperText={`${DEFAULT_REQUIREMENTS.chore} chore, ${DEFAULT_REQUIREMENTS.event} event, and ${DEFAULT_REQUIREMENTS.dinner} dinner slots per camper.`}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              disabled={previewing || rosters.length === 0}
              startIcon={
                previewing ? <CircularProgress size={18} /> : undefined
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
            {KINDS.map((kind) => {
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
                      color={category.shortage ? 'error.main' : 'success.main'}
                    >
                      {category.shortage
                        ? `${category.shortage} slots missing from the catalog`
                        : 'Capacity ready'}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
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
                  {selectedRoster?.year ?? preview.year} signup sheet preview
                </Typography>
                <Typography color="text.secondary">
                  {preview.shifts.length} dated shifts · {preview.camperCount}{' '}
                  prospective campers
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PlaylistAddCheckIcon />}
                disabled={applying || hasShortage}
                onClick={handleApply}
              >
                {applyButtonLabel}
              </Button>
            </Stack>

            {observedDraft && (
              <Alert
                severity={matchesDraft ? 'info' : 'warning'}
                sx={{ mb: 2 }}
              >
                {matchesDraft
                  ? `Saved draft revision ${observedDraft.draftRevision} already uses these inputs and scores.`
                  : `Applying this preview will replace saved draft revision ${observedDraft.draftRevision}.`}
              </Alert>
            )}
            {hasShortage && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Add more scored positions to the catalog before creating this
                plan. The catalog is short by{' '}
                {KINDS.filter((kind) => preview.categories[kind].shortage > 0)
                  .map((kind) => {
                    const { shortage } = preview.categories[kind];
                    return `${shortage} ${kind} position${
                      shortage === 1 ? '' : 's'
                    }`;
                  })
                  .join(', ')}
                .
              </Alert>
            )}

            {KINDS.map((kind) => {
              const shifts = preview.shifts
                .filter((shift) => shift.kind === kind)
                .map(signupSheetShift);
              return (
                <Accordion key={kind} defaultExpanded={kind === 'chore'}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="h6">
                        {CATEGORY_LABELS[kind]}
                      </Typography>
                      <Chip label={`${shifts.length} shifts`} size="small" />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    {shifts.length ? (
                      <SignupSheetTable
                        emptyCellContent={
                          <span className="signup-sheet-no-slots">
                            No slots
                          </span>
                        }
                        kind={kind}
                        shifts={shifts}
                        renderShift={(shift) => (
                          <PositionChips shift={shift.preview} />
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
          </Paper>
        </>
      )}

      <Dialog
        open={confirmingReplacement}
        onClose={() => setConfirmingReplacement(false)}
      >
        <DialogTitle>Replace existing draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This replaces draft revision {observedDraft?.draftRevision} with a{' '}
            {preview?.camperCount}-camper plan using catalog revision{' '}
            {preview?.catalogRevision}. No user signup controls are enabled by
            this action.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingReplacement(false)}>
            Cancel
          </Button>
          <Button color="warning" variant="contained" onClick={applyPreview}>
            Confirm replacement
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

ChorePlanBuilder.defaultProps = {
  planClient: defaultPlanClient,
  rosterClient: defaultRosterClient,
};
