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
