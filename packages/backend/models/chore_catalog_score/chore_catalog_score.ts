import { Model } from 'objection';

export default class ChoreCatalogScore extends Model {
  definitionKey!: string;

  score!: string;

  updatedAt!: Date;

  static tableName = 'chore_catalog_scores';

  static idColumn = 'definitionKey';

  static jsonSchema = {
    type: 'object',
    required: ['definitionKey', 'score'],
    properties: {
      definitionKey: { type: 'string', minLength: 1 },
      score: {
        anyOf: [{ type: 'number' }, { type: 'string', minLength: 1 }],
      },
    },
  };
}
