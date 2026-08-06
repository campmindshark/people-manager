import React, { useEffect, useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ChoreCatalogKind } from 'backend/view_models/chore_catalog';
import {
  ChorePlanShiftViewItem,
  ChorePlanShiftViewPlan,
  ChorePlanShiftViewResponse,
} from 'backend/view_models/chore_plan_shifts';
import BackendChorePlanClient from '../../api/chore_plans/client';
import { getFrontendConfig } from '../../config/config';
import SignupSheetTable, { SignupSheetShift } from './SignupSheetTable';

export interface ChorePlanShiftClient {
  GetShifts: (rosterID: number) => Promise<ChorePlanShiftViewResponse>;
}

interface ChorePlanShiftViewProps {
  rosterID: number;
  planClient?: ChorePlanShiftClient;
}

const frontendConfig = getFrontendConfig();
const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];
const CATEGORY_LABELS: Record<ChoreCatalogKind, string> = {
  chore: 'Daily chores',
  event: 'Event crew',
  dinner: 'Dinner crew',
};

interface MemberSignupSheetShift extends SignupSheetShift {
  item: ChorePlanShiftViewItem;
}

function signupSheetShift(
  item: ChorePlanShiftViewItem,
): MemberSignupSheetShift {
  return {
    key: item.stableKey,
    scheduleName: item.scheduleName,
    day: item.displayDayNumber,
    timePeriod: item.timePeriodLabel,
    periodOrder: item.periodOrder ?? 0,
    item,
  };
}

function requirementChip(
  kind: ChoreCatalogKind,
  plan: ChorePlanShiftViewPlan,
  shifts: ChorePlanShiftViewItem[],
): { color: 'default' | 'success' | 'warning'; label: string } {
  if (plan.status === 'closed') {
    return { color: 'default', label: 'Signups closed' };
  }

  const requirement = plan.requirements[kind];
  if (requirement === 0) {
    return {
      color: 'success',
      label: `${CATEGORY_LABELS[kind]} not required`,
    };
  }
  const assigned = shifts.filter(({ currentUserAssigned }) =>
    Boolean(currentUserAssigned),
  ).length;
  const remaining = Math.max(0, requirement - assigned);
  if (remaining === 0) {
    return { color: 'success', label: 'Requirement complete!' };
  }
  return {
    color: 'warning',
    label: `${remaining} shift${remaining === 1 ? '' : 's'} required!`,
  };
}

function ReadOnlySignupSlots({ shift }: { shift: ChorePlanShiftViewItem }) {
  const slotCount = Math.max(shift.requiredParticipants, shift.slots.length);
  const assignedCount = Math.min(shift.assignedParticipantCount, slotCount);

  if (slotCount === 0) {
    return null;
  }

  return (
    <div className="signup-sheet-slots">
      {Array.from({ length: slotCount }, (_, index) => {
        const currentUser = shift.currentUserAssigned && index === 0;
        if (index < assignedCount) {
          return (
            <span
              className={`signup-sheet-slot filled ${
                currentUser ? 'current-user' : 'other-user'
              }`}
              key={`${shift.stableKey}|slot-${index}`}
            >
              {currentUser ? 'Your signup' : 'Filled'}
            </span>
          );
        }
        return (
          <span
            className="signup-sheet-slot open"
            key={`${shift.stableKey}|slot-${index}`}
          >
            Open spot
          </span>
        );
      })}
    </div>
  );
}

export default function ChorePlanShiftView({
  rosterID,
  planClient,
}: ChorePlanShiftViewProps) {
  const client = useMemo<ChorePlanShiftClient>(
    () => planClient ?? new BackendChorePlanClient(frontendConfig.BackendURL),
    [planClient],
  );
  const [response, setResponse] = useState<ChorePlanShiftViewResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResponse(null);
    setError(null);

    client
      .GetShifts(rosterID)
      .then((nextResponse) => {
        if (active) {
          setResponse(nextResponse);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            'Chore plan shifts are available only to verified roster members.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [client, rosterID]);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!response) {
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Loading the signup sheets…
        </Typography>
      </Paper>
    );
  }
  const { plan } = response;
  if (!plan) {
    return (
      <Alert severity="info">No chore plan is available for this roster.</Alert>
    );
  }
  if (plan.status === 'draft') {
    return (
      <Alert severity="info">
        The chore plan is still being prepared. Generated shifts will appear
        after it opens.
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: { xs: 1, sm: 3 } }}>
      <Stack spacing={2}>
        <Alert severity={plan.status === 'open' ? 'success' : 'info'}>
          {plan.status === 'open'
            ? `Chore signups are open for ${plan.planningYear}.`
            : `The ${plan.planningYear} chore plan is closed. Assignments are read-only.`}
        </Alert>
        {response.shifts.length === 0 ? (
          <Alert severity="warning">This plan has no generated shifts.</Alert>
        ) : (
          KINDS.map((kind) => {
            const items = response.shifts.filter(
              (shift) => shift.kind === kind,
            );
            const shifts = items.map(signupSheetShift);
            const status = requirementChip(kind, plan, items);
            return (
              <Accordion key={kind} defaultExpanded={kind === 'chore'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0.5, sm: 2 }}
                  >
                    <Typography variant="h6">
                      {CATEGORY_LABELS[kind]}
                    </Typography>
                    <Chip
                      color={status.color}
                      label={status.label}
                      size="small"
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 0, sm: 2 } }}>
                  {shifts.length ? (
                    <SignupSheetTable
                      emptyCellContent={null}
                      kind={kind}
                      shifts={shifts}
                      renderShift={(shift) => (
                        <ReadOnlySignupSlots shift={shift.item} />
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
          })
        )}
      </Stack>
    </Paper>
  );
}

ChorePlanShiftView.defaultProps = {
  planClient: undefined,
};
