import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Roster from 'backend/models/roster/roster';
import {
  ChorePlanApplyRequest,
  ChorePlanApplyResponse,
  ChorePlanDraftResponse,
  ChorePlanDraftSummary,
  ChorePlanPreview,
  ChorePlanPreviewRequest,
  ChorePlanRequirements,
} from 'backend/view_models/chore_plan_preview';
import BackendChorePlanClient from '../../api/chore_plans/client';
import BackendRosterClient from '../../api/roster/roster';
import { getFrontendConfig } from '../../config/config';

const frontendConfig = getFrontendConfig();
const defaultPlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);
const defaultRosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const KINDS = ['chore', 'event', 'dinner'] as const;

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
  choreRequirement: string;
  eventRequirement: string;
  dinnerRequirement: string;
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
  const requirements = {
    chore: wholeNumber(values.choreRequirement, 0, 20),
    event: wholeNumber(values.eventRequirement, 0, 20),
    dinner: wholeNumber(values.dinnerRequirement, 0, 20),
  };
  if (
    rosterID === null ||
    camperCount === null ||
    requirements.chore === null ||
    requirements.event === null ||
    requirements.dinner === null
  ) {
    return null;
  }
  return {
    rosterID,
    camperCount,
    requirements: requirements as ChorePlanRequirements,
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

export default function ChorePlanBuilder({
  planClient = defaultPlanClient,
  rosterClient = defaultRosterClient,
}: ChorePlanBuilderProps) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [values, setValues] = useState<FormValues>({
    rosterID: '',
    camperCount: '',
    choreRequirement: '3',
    eventRequirement: '3',
    dinnerRequirement: '1',
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

  const handlePreview = async () => {
    const request = parseForm(values);
    if (!request) {
      setError(
        'Choose a roster, enter 1–200 campers, and use whole requirements from 0–20.',
      );
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
        setSuccess(
          `Draft revision ${response.draft.draftRevision} already matches this preview.`,
        );
      } else if (response.replaced) {
        setSuccess(
          `Replaced the draft with revision ${response.draft.draftRevision}.`,
        );
      } else {
        setSuccess(`Created draft revision ${response.draft.draftRevision}.`);
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

  let applyButtonLabel = 'Apply new draft';
  if (applying) {
    applyButtonLabel = 'Applying…';
  } else if (replacesDraft) {
    applyButtonLabel = 'Replace existing draft';
  } else if (matchesDraft) {
    applyButtonLabel = 'Reapply unchanged draft';
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

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="planner-roster-label">Roster</InputLabel>
          <Select
            labelId="planner-roster-label"
            label="Roster"
            value={values.rosterID}
            onChange={handleRosterChange}
          >
            {rosters.map((roster) => (
              <MenuItem key={roster.id} value={String(roster.id)}>
                {roster.year} (ID: {roster.id})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Camper count"
          type="number"
          value={values.camperCount}
          onChange={(event) => setField('camperCount', event.target.value)}
          inputProps={{ min: 1, max: 200, step: 1 }}
          helperText="1–200"
        />
        <TextField
          label="Chores per camper"
          type="number"
          value={values.choreRequirement}
          onChange={(event) => setField('choreRequirement', event.target.value)}
          inputProps={{ min: 0, max: 20, step: 1 }}
          helperText="0–20"
        />
        <TextField
          label="Events per camper"
          type="number"
          value={values.eventRequirement}
          onChange={(event) => setField('eventRequirement', event.target.value)}
          inputProps={{ min: 0, max: 20, step: 1 }}
          helperText="0–20"
        />
        <TextField
          label="Dinners per camper"
          type="number"
          value={values.dinnerRequirement}
          onChange={(event) =>
            setField('dinnerRequirement', event.target.value)
          }
          inputProps={{ min: 0, max: 20, step: 1 }}
          helperText="0–20"
        />
      </Stack>
      <Box>
        <Button
          variant="contained"
          onClick={handlePreview}
          disabled={previewing || rosters.length === 0}
        >
          {previewing ? 'Previewing…' : 'Preview plan'}
        </Button>
      </Box>

      {preview && (
        <Stack spacing={2}>
          <Typography variant="h5">Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            Roster {preview.rosterID}, catalog revision{' '}
            {preview.catalogRevision}, {preview.camperCount} campers.
          </Typography>
          {observedDraft && (
            <Alert severity={matchesDraft ? 'info' : 'warning'}>
              {matchesDraft
                ? `Saved draft revision ${observedDraft.draftRevision} already uses these inputs and scores.`
                : `Applying this preview will replace saved draft revision ${observedDraft.draftRevision}.`}
            </Alert>
          )}
          {hasShortage && (
            <Alert severity="warning">
              This preview cannot be applied because the catalog is short by{' '}
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

          <TableContainer>
            <Table size="small" aria-label="Chore plan category summary">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Target</TableCell>
                  <TableCell align="right">Selected</TableCell>
                  <TableCell align="right">Shortage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {KINDS.map((kind) => (
                  <TableRow key={kind}>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {kind}
                    </TableCell>
                    <TableCell align="right">
                      {preview.categories[kind].target}
                    </TableCell>
                    <TableCell align="right">
                      {preview.categories[kind].selected}
                    </TableCell>
                    <TableCell align="right">
                      {preview.categories[kind].shortage}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader size="small" aria-label="Chore plan shifts">
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>UTC interval</TableCell>
                  <TableCell>Positions</TableCell>
                  <TableCell align="right">Capacity</TableCell>
                  <TableCell align="right">Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.shifts.map((shift) => (
                  <TableRow key={shift.stableKey}>
                    <TableCell>{shift.displayDayLabel}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {shift.kind}
                    </TableCell>
                    <TableCell>{shift.scheduleName}</TableCell>
                    <TableCell>{shift.timePeriodLabel}</TableCell>
                    <TableCell>
                      {shift.startTime}–{shift.endTime}
                    </TableCell>
                    <TableCell>
                      {shift.slots
                        .map(({ positionLabel }) => positionLabel)
                        .join(', ')}
                    </TableCell>
                    <TableCell align="right">
                      {shift.requiredParticipants}
                    </TableCell>
                    <TableCell align="right">{shift.totalScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box>
            <Button
              variant="contained"
              color={replacesDraft ? 'warning' : 'primary'}
              onClick={handleApply}
              disabled={applying || hasShortage}
            >
              {applyButtonLabel}
            </Button>
          </Box>
        </Stack>
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
