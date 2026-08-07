import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  useRecoilRefresher_UNSTABLE,
  useRecoilValue,
  useSetRecoilState,
} from 'recoil';
import { ChorePlanReadinessResponse } from 'backend/view_models/chore_plan_readiness';
import ChorePlanReadinessReviewDialog from 'src/components/admin/ChorePlanReadinessDashboard';
import ChorePlanShiftView from 'src/components/shifts/ChorePlanShiftView';
import ChoreRequirementOverrides from 'src/components/admin/ChoreRequirementOverrides';
import ChoreSignupControls, {
  ChoreSignupButton,
  ChoreSignupReopenDialog,
  useChoreSignupControls,
} from 'src/components/shifts/ChoreSignupControls';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import BackendChorePlanClient from '../api/chore_plans/client';
import { getFrontendConfig } from '../config/config';
import Dashboard from '../layouts/dashboard/Dashboard';
import { FeatureFlagsState } from '../state/features';
import { CurrentRosterState } from '../state/roster';
import PageState, {
  CurrentUserIsVerified,
  CurrentUserSignupStatus,
  MyRolesState,
} from '../state/store';

const frontendConfig = getFrontendConfig();
const chorePlanClient = new BackendChorePlanClient(frontendConfig.BackendURL);

function readinessErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const { response } = error as {
      response?: { data?: { error?: string }; status?: number };
    };
    if (response?.data?.error) {
      return response.data.error;
    }
    if (response?.status === 403) {
      return 'You do not have permission to review chore plan readiness.';
    }
  }
  return 'Could not load chore plan readiness. Please try again.';
}

export function VerifiedShiftExperience({
  rosterID,
  adminEditMode = false,
  canForceAssignments = false,
  onParticipantStatusChanged,
}: {
  rosterID: number;
  adminEditMode?: boolean;
  canForceAssignments?: boolean;
  onParticipantStatusChanged?: () => void;
}) {
  const featureFlags = useRecoilValue(FeatureFlagsState);

  return featureFlags.chorePlanning ? (
    <ChorePlanShiftView
      adminEditMode={adminEditMode}
      canForceAssignments={canForceAssignments}
      onParticipantStatusChanged={onParticipantStatusChanged}
      rosterID={rosterID}
    />
  ) : (
    <ShiftDisplay />
  );
}

VerifiedShiftExperience.defaultProps = {
  adminEditMode: false,
  canForceAssignments: false,
  onParticipantStatusChanged: undefined,
};

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const featureFlags = useRecoilValue(FeatureFlagsState);
  const roles = useRecoilValue(MyRolesState);
  const refreshSignupStatus = useRecoilRefresher_UNSTABLE(
    CurrentUserSignupStatus,
  );
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [requirementRevision, setRequirementRevision] = useState(0);
  const [readiness, setReadiness] = useState<ChorePlanReadinessResponse | null>(
    null,
  );
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [readinessReviewOpen, setReadinessReviewOpen] = useState(false);
  const canManageAssignments =
    featureFlags.chorePlanning &&
    roles.some((role) => role.permissions.includes('chorePlans:assign'));
  const canForceAssignments = roles.some((role) =>
    role.permissions.includes('chorePlans:forceAssign'),
  );
  const canOverrideRequirements =
    featureFlags.chorePlanning &&
    roles.some((role) =>
      role.permissions.includes('chorePlans:overrideRequirements'),
    );
  const canReviewReadiness =
    featureFlags.chorePlanning &&
    roles.some((role) => role.permissions.includes('chorePlans:readiness'));
  const canAdminEdit = canManageAssignments || canOverrideRequirements;
  const {
    canManageChorePlans,
    canReopenChorePlans,
    plan: chorePlan,
    loading: choreSignupLoading,
    error: choreSignupError,
    reviewingReopen,
    setReviewingReopen,
    toggleSignups,
    reopenSignups,
  } = useChoreSignupControls();

  const loadReadiness = useCallback(async () => {
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      setReadiness(await chorePlanClient.GetReadiness(currentRoster.id));
    } catch (error) {
      setReadiness(null);
      setReadinessError(readinessErrorMessage(error));
    } finally {
      setReadinessLoading(false);
    }
  }, [currentRoster.id]);

  const reviewLifecycleChange = () => {
    setReadinessReviewOpen(true);
    loadReadiness();
  };

  const confirmLifecycleChange = async () => {
    setReadinessReviewOpen(false);
    await toggleSignups();
    refreshSignupStatus();
  };

  const handleReopenSignups = async (reason: string) => {
    await reopenSignups(reason);
    refreshSignupStatus();
  };

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  }, [setPageState]);

  useEffect(() => {
    if (!canAdminEdit) {
      setAdminEditMode(false);
    }
  }, [canAdminEdit]);

  if (!featureFlags.chorePlanning) {
    return (
      <Dashboard>
        <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
          {userIsVerified ? (
            <ShiftDisplay />
          ) : (
            <h1>Verify your account to sign up for shifts.</h1>
          )}
        </Container>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack spacing={3}>
          <Stack
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h3" component="h1" gutterBottom>
                {currentRoster.year} shift signup
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
                Browse the chore, event, and dinner sheets generated from this
                year&apos;s chore plan.
              </Typography>
            </Box>
            <Stack
              alignItems={{ xs: 'stretch', sm: 'flex-end' }}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
            >
              {canManageChorePlans && (
                <ChoreSignupButton
                  canReopen={canReopenChorePlans}
                  loading={choreSignupLoading}
                  onReviewReopen={() => setReviewingReopen(true)}
                  onToggleSignups={
                    canReviewReadiness ? reviewLifecycleChange : toggleSignups
                  }
                  plan={chorePlan}
                />
              )}
              {canAdminEdit && userIsVerified && (
                <Button
                  color={adminEditMode ? 'secondary' : 'primary'}
                  onClick={() => setAdminEditMode((enabled) => !enabled)}
                  variant={adminEditMode ? 'contained' : 'outlined'}
                >
                  {adminEditMode ? 'Exit Admin Edit' : 'Admin Edit'}
                </Button>
              )}
            </Stack>
          </Stack>
          <ChoreSignupControls
            canManageChorePlans={canManageChorePlans}
            error={choreSignupError}
            loading={choreSignupLoading}
            plan={chorePlan}
            rosterYear={currentRoster.year}
          />
          {adminEditMode && canOverrideRequirements && userIsVerified && (
            <ChoreRequirementOverrides
              onChanged={() => {
                setRequirementRevision((current) => current + 1);
                refreshSignupStatus();
              }}
              rosterID={currentRoster.id}
            />
          )}
          {userIsVerified ? (
            <VerifiedShiftExperience
              adminEditMode={adminEditMode && canManageAssignments}
              canForceAssignments={canForceAssignments}
              key={`${chorePlan?.id ?? 'none'}:${
                chorePlan?.status ?? 'loading'
              }:${requirementRevision}`}
              onParticipantStatusChanged={refreshSignupStatus}
              rosterID={currentRoster.id}
            />
          ) : (
            <Alert severity="info">
              Verify your account to view the shift signup sheets.
            </Alert>
          )}
        </Stack>
        <ChoreSignupReopenDialog
          loading={choreSignupLoading}
          onClose={() => setReviewingReopen(false)}
          onReopen={handleReopenSignups}
          open={reviewingReopen}
        />
        {canReviewReadiness && chorePlan?.status !== 'closed' && (
          <ChorePlanReadinessReviewDialog
            action={chorePlan?.status === 'open' ? 'close' : 'open'}
            confirming={choreSignupLoading}
            error={readinessError}
            loading={readinessLoading}
            onClose={() => setReadinessReviewOpen(false)}
            onConfirm={confirmLifecycleChange}
            onRetry={loadReadiness}
            open={readinessReviewOpen}
            readiness={readiness}
          />
        )}
      </Container>
    </Dashboard>
  );
}
