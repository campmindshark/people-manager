import { Model } from 'objection';
import {
  ChoreCatalogDayMode,
  ChorePlanKind,
} from '../../domain/chore_planning';
import ChoreCatalogScore from '../chore_catalog_score/chore_catalog_score';

export default class ChoreCatalogDefinition extends Model {
  stableKey!: string;

  kind!: ChorePlanKind;

  shiftLabel!: string;

  positionLabel!: string;

  dayMode!: ChoreCatalogDayMode;

  dayNumber!: number | null;

  dayLabel!: string | null;

  timePeriodLabel!: string;

  periodOrder!: number | null;

  startLocalTime!: string;

  endLocalTime!: string;

  endDayOffset!: 0 | 1;

  sourceOrder!: number;

  static tableName = 'chore_catalog_definitions';

  static idColumn = 'stableKey';

  static jsonSchema = {
    type: 'object',
    required: [
      'stableKey',
      'kind',
      'shiftLabel',
      'positionLabel',
      'dayMode',
      'timePeriodLabel',
      'startLocalTime',
      'endLocalTime',
      'endDayOffset',
      'sourceOrder',
    ],
    properties: {
      stableKey: { type: 'string', minLength: 1 },
      kind: { enum: ['chore', 'event', 'dinner'] },
      shiftLabel: { type: 'string', minLength: 1 },
      positionLabel: { type: 'string', minLength: 1 },
      dayMode: { enum: ['template', 'explicit'] },
      dayNumber: { type: ['integer', 'null'], minimum: 1, maximum: 7 },
      dayLabel: { type: ['string', 'null'] },
      timePeriodLabel: { type: 'string', minLength: 1 },
      periodOrder: { type: ['integer', 'null'], minimum: 1 },
      endDayOffset: { enum: [0, 1] },
      sourceOrder: { type: 'integer', minimum: 0 },
    },
  };

  static relationMappings = {
    score: {
      relation: Model.HasOneRelation,
      modelClass: ChoreCatalogScore,
      join: {
        from: 'chore_catalog_definitions.stableKey',
        to: 'chore_catalog_scores.definitionKey',
      },
    },
  };
}
