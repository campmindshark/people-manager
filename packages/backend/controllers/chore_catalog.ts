import { Knex } from 'knex';
import ChoreCatalogDefinition from '../models/chore_catalog_definition/chore_catalog_definition';
import {
  ChoreCatalogDefinitionView,
  ChoreCatalogResponse,
  ChoreCatalogScoreUpdateRequest,
  ChoreCatalogScoreUpdateResponse,
} from '../view_models/chore_catalog';
import ChoreCatalogError from '../utils/choreCatalogError';

interface CatalogRow {
  stableKey: string;
  kind: 'chore' | 'event' | 'dinner';
  shiftLabel: string;
  positionLabel: string;
  dayMode: 'template' | 'explicit';
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
  sourceOrder: number;
  score: string | null;
  revision: string;
}

interface ScoreRow {
  score: string;
}

function definitionView(
  row: Omit<CatalogRow, 'revision'>,
): ChoreCatalogDefinitionView {
  if (row.score === null) {
    throw new ChoreCatalogError('The chore catalog is incomplete.', 500);
  }

  return {
    stableKey: row.stableKey,
    kind: row.kind,
    shiftLabel: row.shiftLabel,
    positionLabel: row.positionLabel,
    dayMode: row.dayMode,
    dayNumber: row.dayNumber,
    dayLabel: row.dayLabel,
    timePeriodLabel: row.timePeriodLabel,
    periodOrder: row.periodOrder,
    startLocalTime: row.startLocalTime,
    endLocalTime: row.endLocalTime,
    endDayOffset: row.endDayOffset,
    sourceOrder: row.sourceOrder,
    score: Number(row.score),
  };
}

export default class ChoreCatalogController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? ChoreCatalogDefinition.knex();
  }

  async getCatalog(): Promise<ChoreCatalogResponse> {
    const database = this.getDatabase();
    const rows = (await database('chore_catalog_definitions as definition')
      .crossJoin(database.raw('?? as ??', ['chore_catalog_state', 'state']))
      .leftJoin(
        'chore_catalog_scores as score',
        'score.definitionKey',
        'definition.stableKey',
      )
      .where('state.id', 1)
      .select(
        'definition.stableKey',
        'definition.kind',
        'definition.shiftLabel',
        'definition.positionLabel',
        'definition.dayMode',
        'definition.dayNumber',
        'definition.dayLabel',
        'definition.timePeriodLabel',
        'definition.periodOrder',
        'definition.startLocalTime',
        'definition.endLocalTime',
        'definition.endDayOffset',
        'definition.sourceOrder',
        'score.score',
        'state.revision',
      )
      .orderByRaw(
        `CASE "definition"."kind"
          WHEN 'chore' THEN 1
          WHEN 'event' THEN 2
          WHEN 'dinner' THEN 3
          ELSE 4
        END`,
      )
      .orderBy('definition.sourceOrder')) as CatalogRow[];

    if (rows.length === 0) {
      throw new ChoreCatalogError('The chore catalog is unavailable.', 500);
    }

    return {
      revision: String(rows[0].revision),
      definitions: rows.map(({ revision: _revision, ...row }) =>
        definitionView(row),
      ),
    };
  }

  async updateScore(
    definitionKey: string,
    input: ChoreCatalogScoreUpdateRequest,
    actorUserID: number,
  ): Promise<ChoreCatalogScoreUpdateResponse> {
    return this.getDatabase().transaction(async (transaction) => {
      const state = await transaction('chore_catalog_state')
        .where({ id: 1 })
        .forUpdate()
        .first();

      if (!state) {
        throw new ChoreCatalogError('The chore catalog is unavailable.', 500);
      }

      const previousRevision = String(state.revision);
      if (previousRevision !== input.expectedRevision) {
        throw new ChoreCatalogError(
          'The chore catalog changed. Refresh and try again.',
          409,
        );
      }

      const definition = (await transaction('chore_catalog_definitions')
        .where({ stableKey: definitionKey })
        .forUpdate()
        .first()) as Omit<CatalogRow, 'revision' | 'score'> | undefined;

      if (!definition) {
        throw new ChoreCatalogError('Catalog definition not found.', 404);
      }

      const currentScore = (await transaction('chore_catalog_scores')
        .select('score')
        .where({ definitionKey })
        .forUpdate()
        .first()) as ScoreRow | undefined;

      if (!currentScore) {
        throw new ChoreCatalogError('The chore catalog is incomplete.', 500);
      }

      if (Number(currentScore.score) === input.score) {
        return {
          revision: previousRevision,
          definition: definitionView({
            ...definition,
            score: currentScore.score,
          }),
        };
      }

      const newRevision = (BigInt(previousRevision) + 1n).toString();
      await transaction('chore_catalog_scores')
        .where({ definitionKey })
        .update({ score: input.score, updatedAt: transaction.fn.now() });
      await transaction('chore_catalog_state')
        .where({ id: 1 })
        .update({ revision: newRevision, updatedAt: transaction.fn.now() });
      await transaction('chore_catalog_score_audit_entries').insert({
        actorUserID,
        definitionKey,
        oldScore: currentScore.score,
        newScore: input.score,
        previousRevision,
        newRevision,
      });

      return {
        revision: newRevision,
        definition: definitionView({
          ...definition,
          score: String(input.score),
        }),
      };
    });
  }
}
