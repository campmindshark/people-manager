import { Model } from 'objection';

export default class ChoreCatalogState extends Model {
  id!: 1;

  revision!: string;

  updatedAt!: Date;

  static tableName = 'chore_catalog_state';

  static jsonSchema = {
    type: 'object',
    required: ['id', 'revision'],
    properties: {
      id: { type: 'integer', const: 1 },
      revision: {
        anyOf: [
          { type: 'integer', minimum: 1 },
          { type: 'string', pattern: '^[1-9][0-9]*$' },
        ],
      },
    },
  };
}
