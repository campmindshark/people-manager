import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ChoreCatalogDefinitionView,
  ChoreCatalogKind,
  ChoreCatalogResponse,
  ChoreCatalogScoreUpdateRequest,
  ChoreCatalogScoreUpdateResponse,
} from 'backend/view_models/chore_catalog';
import BackendChoreCatalogClient from '../../api/chore_catalog/client';
import { getFrontendConfig } from '../../config/config';

const defaultClient = new BackendChoreCatalogClient(
  getFrontendConfig().BackendURL,
);
const SCORE_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/;
const KINDS: ChoreCatalogKind[] = ['chore', 'event', 'dinner'];

export interface ChoreCatalogClient {
  GetCatalog: () => Promise<ChoreCatalogResponse>;
  UpdateScore: (
    definitionKey: string,
    request: ChoreCatalogScoreUpdateRequest,
  ) => Promise<ChoreCatalogScoreUpdateResponse>;
}

interface ChoreCatalogTableProps {
  client?: ChoreCatalogClient;
}

function editableScore(value: string): number | null {
  const trimmed = value.trim();
  if (!SCORE_PATTERN.test(trimmed)) {
    return null;
  }

  const score = Number(trimmed);
  return score >= 0 && score <= 100 ? score : null;
}

function responseStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function displayDay(definition: ChoreCatalogDefinitionView): string {
  return definition.dayMode === 'template'
    ? 'Each planning day (template)'
    : `${definition.dayLabel} (day ${definition.dayNumber})`;
}

function displayInterval(definition: ChoreCatalogDefinitionView): string {
  return `${definition.startLocalTime}–${definition.endLocalTime}${
    definition.endDayOffset === 1 ? ' (+1 day)' : ''
  }`;
}

export default function ChoreCatalogTable({
  client = defaultClient,
}: ChoreCatalogTableProps) {
  const [catalog, setCatalog] = useState<ChoreCatalogResponse | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [activeKind, setActiveKind] = useState<ChoreCatalogKind>('chore');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (preserveError = false) => {
      setLoading(true);
      try {
        const response = await client.GetCatalog();
        setCatalog(response);
        setDraftScores(
          Object.fromEntries(
            response.definitions.map(({ stableKey, score }) => [
              stableKey,
              String(score),
            ]),
          ),
        );
        if (!preserveError) {
          setError(null);
        }
      } catch (loadError) {
        console.error('Failed to load chore catalog:', loadError);
        if (responseStatus(loadError) === 403) {
          setError('You do not have permission to view chore scores.');
        } else {
          setError('Failed to load chore scores. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const visibleDefinitions = useMemo(
    () => catalog?.definitions.filter(({ kind }) => kind === activeKind) ?? [],
    [activeKind, catalog],
  );

  const handleSave = async (definition: ChoreCatalogDefinitionView) => {
    if (!catalog) {
      return;
    }

    const score = editableScore(draftScores[definition.stableKey] ?? '');
    if (score === null) {
      setError('Score must be from 0 through 100 with at most two decimals.');
      return;
    }

    setSavingKey(definition.stableKey);
    setError(null);
    setSuccess(null);
    try {
      const response = await client.UpdateScore(definition.stableKey, {
        score,
        expectedRevision: catalog.revision,
      });
      setCatalog((current) =>
        current
          ? {
              revision: response.revision,
              definitions: current.definitions.map((entry) =>
                entry.stableKey === response.definition.stableKey
                  ? response.definition
                  : entry,
              ),
            }
          : current,
      );
      setDraftScores((current) => ({
        ...current,
        [definition.stableKey]: String(response.definition.score),
      }));
      setSuccess(
        `Saved ${definition.shiftLabel} — ${definition.positionLabel}.`,
      );
    } catch (updateError) {
      const status = responseStatus(updateError);
      if (status === 409) {
        setError(
          'Scores changed in another session. The catalog was refreshed.',
        );
        await loadCatalog(true);
      } else if (status === 403) {
        setError('You do not have permission to edit chore scores.');
      } else {
        console.error('Failed to update chore score:', updateError);
        setError('Failed to save the score. Please try again.');
      }
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && !catalog) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress aria-label="Loading chore scores" />
      </Box>
    );
  }

  if (!catalog) {
    return (
      <Box sx={{ py: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Button onClick={() => loadCatalog()} variant="outlined" sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Catalog revision {catalog.revision}. Definition fields are fixed; only
        scores can be changed.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      <Tabs
        value={activeKind}
        onChange={(_event, kind: ChoreCatalogKind) => setActiveKind(kind)}
        aria-label="Catalog category"
        sx={{ mb: 2 }}
      >
        {KINDS.map((kind) => (
          <Tab
            key={kind}
            value={kind}
            label={`${kind} (${
              catalog.definitions.filter((entry) => entry.kind === kind).length
            })`}
          />
        ))}
      </Tabs>
      <TableContainer component={Paper}>
        <Table size="small" aria-label={`${activeKind} score catalog`}>
          <TableHead>
            <TableRow>
              <TableCell>Stable key</TableCell>
              <TableCell>Day</TableCell>
              <TableCell>Time label</TableCell>
              <TableCell>Shift</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Local interval</TableCell>
              <TableCell align="right">Period order</TableCell>
              <TableCell align="right">Source order</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleDefinitions.map((definition) => {
              const draft = draftScores[definition.stableKey] ?? '';
              const parsedScore = editableScore(draft);
              const unchanged = parsedScore === definition.score;
              const saving = savingKey === definition.stableKey;

              return (
                <TableRow key={definition.stableKey}>
                  <TableCell>{definition.stableKey}</TableCell>
                  <TableCell>{displayDay(definition)}</TableCell>
                  <TableCell>{definition.timePeriodLabel}</TableCell>
                  <TableCell>{definition.shiftLabel}</TableCell>
                  <TableCell>{definition.positionLabel}</TableCell>
                  <TableCell>{displayInterval(definition)}</TableCell>
                  <TableCell align="right">
                    {definition.periodOrder ?? '—'}
                  </TableCell>
                  <TableCell align="right">{definition.sourceOrder}</TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      size="small"
                      value={draft}
                      error={parsedScore === null}
                      onChange={(event) =>
                        setDraftScores((current) => ({
                          ...current,
                          [definition.stableKey]: event.target.value,
                        }))
                      }
                      inputProps={{
                        min: 0,
                        max: 100,
                        step: 0.01,
                        'aria-label': `Score for ${definition.stableKey}`,
                      }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      aria-label={`Save score for ${definition.stableKey}`}
                      variant="contained"
                      size="small"
                      disabled={parsedScore === null || unchanged || saving}
                      onClick={() => handleSave(definition)}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

ChoreCatalogTable.defaultProps = {
  client: defaultClient,
};
