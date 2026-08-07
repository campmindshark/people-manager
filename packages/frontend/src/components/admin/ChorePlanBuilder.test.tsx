import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Roster from 'backend/models/roster/roster';
import {
  ChorePlanApplyResponse,
  ChorePlanDraftSummary,
  ChorePlanPreview,
} from 'backend/view_models/chore_plan_preview';
import ChorePlanBuilder, {
  ChorePlannerClient,
  ChorePlannerRosterClient,
} from './ChorePlanBuilder';

const roster = { id: 1, year: 2026 } as Roster;

function preview(overrides: Partial<ChorePlanPreview> = {}): ChorePlanPreview {
  return {
    rosterID: 1,
    year: 2026,
    camperCount: 1,
    requirements: { chore: 3, event: 3, dinner: 1 },
    catalogRevision: '7',
    categories: {
      chore: { target: 3, selected: 3, shortage: 0 },
      event: { target: 3, selected: 3, shortage: 0 },
      dinner: { target: 1, selected: 1, shortage: 0 },
    },
    shifts: [
      {
        stableKey: 'chore|1|chore-am-chum-wench-first',
        scheduleKey: 'chore|AM Chum Wench',
        kind: 'chore',
        scheduleName: 'AM Chum Wench',
        displayDayNumber: 1,
        displayDayLabel: 'Sunday, Aug 30',
        calendarDay: 1,
        timePeriodLabel: '11:00:00 AM',
        periodOrder: null,
        startTime: '2026-08-30T18:00:00.000Z',
        endTime: '2026-08-30T19:00:00.000Z',
        requiredParticipants: 1,
        totalScore: 100,
        slots: [
          {
            definitionKey: 'chore-am-chum-wench-first',
            positionLabel: 'First',
            score: 100,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function draft(
  sourcePreview: ChorePlanPreview,
  overrides: Partial<ChorePlanDraftSummary> = {},
): ChorePlanDraftSummary {
  return {
    id: 10,
    rosterID: sourcePreview.rosterID,
    status: 'draft',
    draftRevision: '4',
    catalogRevision: sourcePreview.catalogRevision,
    planningYear: sourcePreview.year,
    camperCount: sourcePreview.camperCount,
    requirements: sourcePreview.requirements,
    scheduleCount: 1,
    shiftCount: sourcePreview.shifts.length,
    slotCount: sourcePreview.shifts.reduce(
      (total, shift) => total + shift.slots.length,
      0,
    ),
    updatedAt: '2026-08-06T12:00:00.000Z',
    ...overrides,
  };
}

function applyResponse(
  sourcePreview: ChorePlanPreview,
  sourceDraft: ChorePlanDraftSummary,
  overrides: Partial<ChorePlanApplyResponse> = {},
): ChorePlanApplyResponse {
  return {
    changed: true,
    replaced: false,
    draft: sourceDraft,
    preview: sourcePreview,
    ...overrides,
  };
}

function clients(
  previewResult: ChorePlanPreview,
  currentDraft: ChorePlanDraftSummary | null,
  applyResult?: ChorePlanApplyResponse,
) {
  const planClient: ChorePlannerClient = {
    Preview: jest.fn().mockResolvedValue(previewResult),
    GetDraft: jest.fn().mockResolvedValue({ draft: currentDraft }),
    Apply: jest
      .fn()
      .mockResolvedValue(
        applyResult ??
          applyResponse(
            previewResult,
            draft(previewResult, { draftRevision: '1' }),
          ),
      ),
  };
  const rosterClient: ChorePlannerRosterClient = {
    GetAllRosters: jest.fn().mockResolvedValue([roster]),
  };
  return { planClient, rosterClient };
}

async function enterCamperCount(value: string) {
  const input = await screen.findByRole('spinbutton', {
    name: /prospective campers/i,
  });
  userEvent.clear(input);
  userEvent.type(input, value);
  return input;
}

test('previews and applies a new draft through the narrow request contracts', async () => {
  const generated = preview();
  const savedDraft = draft(generated, { draftRevision: '1' });
  const { planClient, rosterClient } = clients(
    generated,
    null,
    applyResponse(generated, savedDraft),
  );
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));

  await waitFor(() =>
    expect(planClient.Preview).toHaveBeenCalledWith({
      rosterID: 1,
      camperCount: 1,
      requirements: { chore: 3, event: 3, dinner: 1 },
    }),
  );
  expect(planClient.GetDraft).toHaveBeenCalledWith(1);
  expect(await screen.findByText('AM Chum Wench')).toBeVisible();
  expect(screen.getAllByText('Daily chores')).toHaveLength(2);
  expect(screen.getByText('First')).toBeVisible();

  userEvent.click(screen.getByRole('button', { name: /create signup plan/i }));
  await waitFor(() =>
    expect(planClient.Apply).toHaveBeenCalledWith({
      rosterID: 1,
      camperCount: 1,
      requirements: { chore: 3, event: 3, dinner: 1 },
      expectedCatalogRevision: '7',
      expectedDraftRevision: null,
    }),
  );
  expect(
    await screen.findByText(/created signup plan draft revision 1/i),
  ).toBeVisible();
});

test('requires explicit confirmation before replacing an observed draft', async () => {
  const generated = preview();
  const currentDraft = draft(generated, { camperCount: 2 });
  const replacementDraft = draft(generated, { draftRevision: '5' });
  const { planClient, rosterClient } = clients(
    generated,
    currentDraft,
    applyResponse(generated, replacementDraft, { replaced: true }),
  );
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));
  expect(
    await screen.findByText(/will replace saved draft revision 4/i),
  ).toBeVisible();

  userEvent.click(screen.getByRole('button', { name: /apply plan updates/i }));
  expect(
    screen.getByRole('dialog', { name: /replace existing draft/i }),
  ).toBeVisible();
  expect(planClient.Apply).not.toHaveBeenCalled();

  userEvent.click(screen.getByRole('button', { name: /confirm replacement/i }));
  await waitFor(() =>
    expect(planClient.Apply).toHaveBeenCalledWith(
      expect.objectContaining({ expectedDraftRevision: '4' }),
    ),
  );
  expect(
    await screen.findByText(/applied signup plan updates in draft revision 5/i),
  ).toBeVisible();
});

test('reapplies an identical draft without a replacement dialog', async () => {
  const generated = preview();
  const currentDraft = draft(generated);
  const { planClient, rosterClient } = clients(
    generated,
    currentDraft,
    applyResponse(generated, currentDraft, {
      changed: false,
      replaced: false,
    }),
  );
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));
  const applyUpdatesButton = await screen.findByRole('button', {
    name: /apply plan updates/i,
  });
  userEvent.click(applyUpdatesButton);

  await waitFor(() => expect(planClient.Apply).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    await screen.findByText(/saved signup plan already matches this preview/i),
  ).toBeVisible();
});

test('shows exact shortages and prevents apply', async () => {
  const generated = preview({
    categories: {
      chore: { target: 3, selected: 3, shortage: 0 },
      event: { target: 3, selected: 2, shortage: 1 },
      dinner: { target: 1, selected: 0, shortage: 1 },
    },
  });
  const { planClient, rosterClient } = clients(generated, null);
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));

  expect(
    await screen.findByText(/1 event position, 1 dinner position/i),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: /create signup plan/i }),
  ).toBeDisabled();
  expect(planClient.Apply).not.toHaveBeenCalled();
});

test('uses the original score bands for preview positions', async () => {
  const generated = preview();
  generated.shifts[0].slots = [
    {
      definitionKey: 'chore-am-chum-wench-first',
      positionLabel: 'First',
      score: 75,
    },
    {
      definitionKey: 'chore-am-chum-wench-second',
      positionLabel: 'Second',
      score: 25,
    },
    {
      definitionKey: 'chore-am-chum-wench-third',
      positionLabel: 'Third',
      score: 24,
    },
  ];
  const { planClient, rosterClient } = clients(generated, null);
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));

  expect(await screen.findByText('First')).toHaveClass('high');
  expect(screen.getByText('Second')).toHaveClass('medium');
  expect(screen.getByText('Third')).toHaveClass('low');
});

test('blocks invalid form values before previewing', async () => {
  const generated = preview();
  const { planClient, rosterClient } = clients(generated, null);
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('201');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));

  expect(
    await screen.findByText(/enter 1–200 prospective campers/i),
  ).toBeVisible();
  expect(planClient.Preview).not.toHaveBeenCalled();
  expect(planClient.GetDraft).not.toHaveBeenCalled();
});

test('explains stale catalog and draft conflicts and requires a new preview', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  const generated = preview();
  const currentDraft = draft(generated);
  const { planClient, rosterClient } = clients(generated, currentDraft);
  (planClient.Apply as jest.Mock).mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'The chore catalog changed. Preview the plan again.' },
    },
  });
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));
  userEvent.click(
    await screen.findByRole('button', {
      name: /apply plan updates/i,
    }),
  );

  expect(
    await screen.findByText(/chore scores changed after this preview/i),
  ).toBeVisible();
  expect(
    screen.queryByText(/signup sheet preview/i, { selector: 'h5' }),
  ).not.toBeInTheDocument();
  consoleError.mockRestore();
});

test('distinguishes a stale saved draft from a score conflict', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  const generated = preview();
  const currentDraft = draft(generated);
  const { planClient, rosterClient } = clients(generated, currentDraft);
  (planClient.Apply as jest.Mock).mockRejectedValue({
    response: {
      status: 409,
      data: { error: 'The chore plan draft changed. Preview it again.' },
    },
  });
  render(
    <ChorePlanBuilder planClient={planClient} rosterClient={rosterClient} />,
  );

  await enterCamperCount('1');
  userEvent.click(screen.getByRole('button', { name: /preview signup plan/i }));
  userEvent.click(
    await screen.findByRole('button', {
      name: /apply plan updates/i,
    }),
  );

  expect(
    await screen.findByText(/saved draft changed after this preview/i),
  ).toBeVisible();
  consoleError.mockRestore();
});
