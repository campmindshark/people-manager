import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ChoreCatalogDefinitionView,
  ChoreCatalogResponse,
  ChoreCatalogScoreUpdateRequest,
  ChoreCatalogScoreUpdateResponse,
} from 'backend/view_models/chore_catalog';
import ChoreCatalogTable, { ChoreCatalogClient } from './ChoreCatalogTable';

const definition: ChoreCatalogDefinitionView = {
  stableKey: 'chore-am-chum-wench-first',
  kind: 'chore',
  shiftLabel: 'AM Chum Wench',
  positionLabel: 'First',
  dayMode: 'template',
  dayNumber: null,
  dayLabel: null,
  timePeriodLabel: '11:00:00 AM',
  periodOrder: null,
  startLocalTime: '11:00:00',
  endLocalTime: '12:00:00',
  endDayOffset: 0,
  sourceOrder: 0,
  score: 100,
};

const closingSundayDefinition: ChoreCatalogDefinitionView = {
  stableKey: 'event-39-audio-manager',
  kind: 'event',
  shiftLabel: 'Audio',
  positionLabel: 'Manager',
  dayMode: 'explicit',
  dayNumber: 8,
  dayLabel: 'Sunday',
  timePeriodLabel: '12a-3a',
  periodOrder: 39,
  startLocalTime: '00:00:00',
  endLocalTime: '03:00:00',
  endDayOffset: 0,
  sourceOrder: 230,
  score: 100,
};

const secondDefinition: ChoreCatalogDefinitionView = {
  ...definition,
  stableKey: 'chore-pm-chum-wench-first',
  shiftLabel: 'PM Chum Wench',
  timePeriodLabel: '6:00:00 PM',
  startLocalTime: '18:00:00',
  endLocalTime: '19:00:00',
  sourceOrder: 1,
  score: 90,
};

function response(revision = '1', score = 100): ChoreCatalogResponse {
  return {
    revision,
    definitions: [{ ...definition, score }],
  };
}

function clientWith(
  getCatalog: () => Promise<ChoreCatalogResponse>,
  updateScore: (
    definitionKey: string,
    request: ChoreCatalogScoreUpdateRequest,
  ) => Promise<ChoreCatalogScoreUpdateResponse>,
): ChoreCatalogClient {
  return { GetCatalog: getCatalog, UpdateScore: updateScore };
}

test('shows fixed definition fields and exposes only score as an input', async () => {
  const client = clientWith(jest.fn().mockResolvedValue(response()), jest.fn());
  render(<ChoreCatalogTable client={client} />);

  expect(await screen.findByText('chore-am-chum-wench-first')).toBeVisible();
  expect(screen.getByText('AM Chum Wench')).toBeVisible();
  expect(screen.getByText('11:00:00 AM')).toBeVisible();
  expect(screen.getByText('Each planning day (template)')).toBeVisible();
  expect(
    screen.getByRole('columnheader', { name: 'Period order' }),
  ).toBeVisible();
  expect(
    screen.getByRole('columnheader', { name: 'Source order' }),
  ).toBeVisible();
  expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  expect(
    screen.getByRole('button', {
      name: 'Save score for chore-am-chum-wench-first',
    }),
  ).toBeDisabled();
});

test('describes the closing Sunday event period as day eight', async () => {
  const client = clientWith(
    jest.fn().mockResolvedValue({
      revision: '1',
      definitions: [definition, closingSundayDefinition],
    }),
    jest.fn(),
  );
  render(<ChoreCatalogTable client={client} />);

  userEvent.click(await screen.findByRole('tab', { name: 'event (1)' }));

  expect(screen.getByText('Sunday (day 8)')).toBeVisible();
  expect(screen.getByText('12a-3a')).toBeVisible();
  expect(screen.getByText('39')).toBeVisible();
});

test('updates only score with the displayed catalog revision', async () => {
  const getCatalog = jest.fn().mockResolvedValue(response());
  const updateScore = jest.fn().mockResolvedValue({
    revision: '2',
    definition: { ...definition, score: 42.25 },
  });
  render(<ChoreCatalogTable client={clientWith(getCatalog, updateScore)} />);

  const input = await screen.findByRole('spinbutton', {
    name: 'Score for chore-am-chum-wench-first',
  });
  userEvent.clear(input);
  userEvent.type(input, '42.25');
  userEvent.click(
    screen.getByRole('button', {
      name: 'Save score for chore-am-chum-wench-first',
    }),
  );

  await waitFor(() =>
    expect(updateScore).toHaveBeenCalledWith('chore-am-chum-wench-first', {
      score: 42.25,
      expectedRevision: '1',
    }),
  );
  expect(await screen.findByText(/catalog revision 2/i)).toBeVisible();
  expect(screen.getByText(/saved am chum wench/i)).toBeVisible();
});

test('disables every save while a score update is pending', async () => {
  const pendingUpdate = new Promise<ChoreCatalogScoreUpdateResponse>(() => {
    // Keep the request pending while the table-wide save lock is asserted.
  });
  const updateScore = jest.fn().mockReturnValue(pendingUpdate);
  const getCatalog = jest.fn().mockResolvedValue({
    revision: '1',
    definitions: [definition, secondDefinition],
  });
  render(<ChoreCatalogTable client={clientWith(getCatalog, updateScore)} />);

  const firstInput = await screen.findByRole('spinbutton', {
    name: 'Score for chore-am-chum-wench-first',
  });
  const secondInput = screen.getByRole('spinbutton', {
    name: 'Score for chore-pm-chum-wench-first',
  });
  userEvent.clear(firstInput);
  userEvent.type(firstInput, '42.25');
  userEvent.clear(secondInput);
  userEvent.type(secondInput, '45');

  const firstSave = screen.getByRole('button', {
    name: 'Save score for chore-am-chum-wench-first',
  });
  const secondSave = screen.getByRole('button', {
    name: 'Save score for chore-pm-chum-wench-first',
  });
  expect(firstSave).toBeEnabled();
  expect(secondSave).toBeEnabled();

  userEvent.click(firstSave);

  await waitFor(() => {
    expect(firstSave).toBeDisabled();
    expect(secondSave).toBeDisabled();
  });
  expect(updateScore).toHaveBeenCalledTimes(1);
});

test('blocks invalid precision before calling the API', async () => {
  const updateScore = jest.fn();
  render(
    <ChoreCatalogTable
      client={clientWith(jest.fn().mockResolvedValue(response()), updateScore)}
    />,
  );

  const input = await screen.findByRole('spinbutton', {
    name: 'Score for chore-am-chum-wench-first',
  });
  userEvent.clear(input);
  userEvent.type(input, '1.234');

  expect(
    screen.getByRole('button', {
      name: 'Save score for chore-am-chum-wench-first',
    }),
  ).toBeDisabled();
  expect(updateScore).not.toHaveBeenCalled();
});

test('refreshes after a stale revision conflict', async () => {
  const getCatalog = jest
    .fn()
    .mockResolvedValueOnce(response('1', 100))
    .mockResolvedValueOnce(response('2', 75));
  const updateScore = jest
    .fn()
    .mockRejectedValue({ response: { status: 409 } });
  render(<ChoreCatalogTable client={clientWith(getCatalog, updateScore)} />);

  const input = await screen.findByRole('spinbutton', {
    name: 'Score for chore-am-chum-wench-first',
  });
  userEvent.clear(input);
  userEvent.type(input, '50');
  userEvent.click(
    screen.getByRole('button', {
      name: 'Save score for chore-am-chum-wench-first',
    }),
  );

  expect(await screen.findByText(/another session/i)).toBeVisible();
  await waitFor(() => expect(getCatalog).toHaveBeenCalledTimes(2));
  expect(input).toHaveValue(75);
  expect(screen.getByText(/catalog revision 2/i)).toBeVisible();
});
