import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChorePlanLifecycleState } from 'backend/view_models/chore_plan_lifecycle';
import ChoreSignupControls, {
  ChoreSignupButton,
  ChoreSignupLifecycleClient,
  ChoreSignupReopenDialog,
  useChoreSignupLifecycle,
} from './ChoreSignupControls';

function lifecycle(
  status: ChorePlanLifecycleState['status'],
): ChorePlanLifecycleState {
  return {
    id: 3,
    rosterID: 2,
    status,
    planningYear: 2026,
    camperCount: 50,
    requirements: { chore: 3, event: 3, dinner: 1 },
    shiftCount: 149,
    slotCount: 350,
    openedAt: status === 'draft' ? null : '2026-08-06T16:00:00.000Z',
    openedByUserID: status === 'draft' ? null : 9,
    closedAt: status === 'closed' ? '2026-08-06T17:00:00.000Z' : null,
    closedByUserID: status === 'closed' ? 10 : null,
    updatedAt: '2026-08-06T17:00:00.000Z',
  };
}

function client(initialPlan: ChorePlanLifecycleState) {
  return {
    GetLifecycle: jest.fn().mockResolvedValue({ plan: initialPlan }),
    Open: jest.fn().mockResolvedValue(lifecycle('open')),
    Close: jest.fn().mockResolvedValue(lifecycle('closed')),
    Reopen: jest.fn().mockResolvedValue(lifecycle('open')),
  };
}

function LifecycleHarness({
  planClient,
  canReopen = true,
}: {
  planClient: ChoreSignupLifecycleClient;
  canReopen?: boolean;
}) {
  const controls = useChoreSignupLifecycle({
    rosterID: 2,
    canManageChorePlans: true,
    canReopenChorePlans: canReopen,
    planClient,
  });

  return (
    <>
      <ChoreSignupButton
        canReopen={controls.canReopenChorePlans}
        loading={controls.loading}
        onReviewReopen={() => controls.setReviewingReopen(true)}
        onToggleSignups={controls.toggleSignups}
        plan={controls.plan}
      />
      <ChoreSignupControls
        canManageChorePlans={controls.canManageChorePlans}
        error={controls.error}
        loading={controls.loading}
        plan={controls.plan}
        rosterYear={2026}
        success={controls.success}
      />
      <ChoreSignupReopenDialog
        loading={controls.loading}
        onClose={() => controls.setReviewingReopen(false)}
        onReopen={controls.reopenSignups}
        open={controls.reviewingReopen}
      />
    </>
  );
}

LifecycleHarness.defaultProps = {
  canReopen: true,
};

test('places draft opening controls with the shift signup status', async () => {
  const planClient = client(lifecycle('draft'));
  render(<LifecycleHarness planClient={planClient} />);

  expect(
    await screen.findByText(
      'The chore plan is visible below, but signups have not opened yet.',
    ),
  ).toBeVisible();
  userEvent.click(screen.getByRole('button', { name: 'Open Chore Signups' }));

  await waitFor(() => expect(planClient.Open).toHaveBeenCalledWith(2));
  expect(
    await screen.findByText('Chore signups are open for 2026.'),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Close Chore Signups' }),
  ).toBeVisible();
});

test('closes open signups from the PR 58 header control', async () => {
  const planClient = client(lifecycle('open'));
  render(<LifecycleHarness planClient={planClient} />);

  userEvent.click(
    await screen.findByRole('button', { name: 'Close Chore Signups' }),
  );

  await waitFor(() => expect(planClient.Close).toHaveBeenCalledWith(2));
  expect(await screen.findByText(/2026 chore plan is closed/i)).toBeVisible();
});

test('requires and trims the audited reason when reopening closed signups', async () => {
  const planClient = client(lifecycle('closed'));
  render(<LifecycleHarness planClient={planClient} />);

  userEvent.click(
    await screen.findByRole('button', { name: 'Reopen Chore Signups' }),
  );
  const reopenButton = screen.getByRole('button', {
    name: 'Reopen signups',
  });
  expect(reopenButton).toBeDisabled();
  userEvent.type(
    screen.getByRole('textbox', { name: 'Reopening reason' }),
    '  Scheduling correction  ',
  );
  expect(reopenButton).toBeEnabled();
  userEvent.click(reopenButton);

  await waitFor(() =>
    expect(planClient.Reopen).toHaveBeenCalledWith(2, 'Scheduling correction'),
  );
  expect(
    await screen.findByText('Chore signups are now open for 2026.'),
  ).toBeVisible();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('keeps reopening unavailable without the separate permission', async () => {
  const planClient = client(lifecycle('closed'));
  render(<LifecycleHarness canReopen={false} planClient={planClient} />);

  expect(
    await screen.findByRole('button', { name: 'Reopen Chore Signups' }),
  ).toBeDisabled();
  expect(planClient.Reopen).not.toHaveBeenCalled();
});
