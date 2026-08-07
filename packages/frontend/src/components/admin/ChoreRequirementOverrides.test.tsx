import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ChorePlanParticipantRequirements,
  ChorePlanRequirementOverrideViewResponse,
} from 'backend/view_models/chore_plan_requirements';
import ChoreRequirementOverrides, {
  ChoreRequirementOverrideClient,
} from './ChoreRequirementOverrides';

const participant: ChorePlanParticipantRequirements = {
  userID: 21,
  firstName: 'Alpha',
  lastName: 'Camper',
  playaName: 'A',
  requirements: { chore: 2, event: 1, dinner: 1 },
  hasOverride: false,
  overrideReason: null,
};

function requirementView(
  overrides: Partial<ChorePlanRequirementOverrideViewResponse> = {},
): ChorePlanRequirementOverrideViewResponse {
  return {
    rosterID: 2,
    plan: {
      id: 3,
      status: 'open',
      requirements: { chore: 2, event: 1, dinner: 1 },
    },
    mutationsAllowed: true,
    participants: [participant],
    ...overrides,
  };
}

function planClient(view = requirementView()): ChoreRequirementOverrideClient {
  return {
    GetRequirementOverrides: jest.fn().mockResolvedValue(view),
    SetRequirementOverride: jest.fn().mockResolvedValue({
      changed: true,
      participant: {
        ...participant,
        requirements: { chore: 0, event: 1, dinner: 1 },
        hasOverride: true,
        overrideReason: 'Accessibility accommodation',
      },
    }),
    ClearRequirementOverride: jest.fn().mockResolvedValue({
      changed: true,
      participant,
    }),
  };
}

test('saves a complete zero-capable override with an exact reason contract', async () => {
  const client = planClient();
  const onChanged = jest.fn();
  render(
    <ChoreRequirementOverrides
      onChanged={onChanged}
      planClient={client}
      rosterID={2}
    />,
  );

  const choreInput = await screen.findByRole('spinbutton', {
    name: 'Alpha Camper (A) chore requirement',
  });
  userEvent.clear(choreInput);
  userEvent.type(choreInput, '0');
  userEvent.type(
    screen.getByRole('textbox', { name: 'Override reason' }),
    '  Accessibility accommodation  ',
  );
  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(client.SetRequirementOverride).toHaveBeenCalledWith(2, 21, {
      requirements: { chore: 0, event: 1, dinner: 1 },
      reason: 'Accessibility accommodation',
    }),
  );
  expect(await screen.findByText('Custom requirements')).toBeVisible();
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
});

test('clears all custom values only after collecting a separate reason', async () => {
  const customParticipant: ChorePlanParticipantRequirements = {
    ...participant,
    requirements: { chore: 0, event: 1, dinner: 0 },
    hasOverride: true,
    overrideReason: 'Temporary accommodation',
  };
  const client = planClient(
    requirementView({ participants: [customParticipant] }),
  );
  render(<ChoreRequirementOverrides planClient={client} rosterID={2} />);

  userEvent.click(await screen.findByRole('button', { name: 'Use defaults' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Use plan defaults for Alpha Camper (A)?',
  });
  const confirm = within(dialog).getByRole('button', {
    name: 'Use defaults',
  });
  expect(confirm).toBeDisabled();
  userEvent.type(
    within(dialog).getByRole('textbox', { name: 'Clear reason' }),
    '  Returned to full participation  ',
  );
  userEvent.click(confirm);

  await waitFor(() =>
    expect(client.ClearRequirementOverride).toHaveBeenCalledWith(2, 21, {
      reason: 'Returned to full participation',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('keeps closed-plan requirements visible and read-only', async () => {
  const client = planClient(
    requirementView({
      plan: {
        id: 3,
        status: 'closed',
        requirements: { chore: 2, event: 1, dinner: 1 },
      },
      mutationsAllowed: false,
    }),
  );
  render(<ChoreRequirementOverrides planClient={client} rosterID={2} />);

  expect(
    await screen.findByText(/read-only while this plan is closed/i),
  ).toBeVisible();
  expect(
    screen.getByRole('spinbutton', {
      name: 'Alpha Camper (A) chore requirement',
    }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
