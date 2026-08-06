import { Model } from 'objection';
import User from '../user/user';
import ChoreCatalogDefinition from '../chore_catalog_definition/chore_catalog_definition';

export default class ChoreCatalogScoreAuditEntry extends Model {
  id!: number;

  actorUserID!: number;

  definitionKey!: string;

  oldScore!: string;

  newScore!: string;

  previousRevision!: string;

  newRevision!: string;

  createdAt!: Date;

  static tableName = 'chore_catalog_score_audit_entries';

  static jsonSchema = {
    type: 'object',
    required: [
      'actorUserID',
      'definitionKey',
      'oldScore',
      'newScore',
      'previousRevision',
      'newRevision',
    ],
    properties: {
      id: { type: 'integer' },
      actorUserID: { type: 'integer' },
      definitionKey: { type: 'string', minLength: 1 },
    },
  };

  static relationMappings = {
    actor: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'chore_catalog_score_audit_entries.actorUserID',
        to: 'users.id',
      },
    },
    definition: {
      relation: Model.BelongsToOneRelation,
      modelClass: ChoreCatalogDefinition,
      join: {
        from: 'chore_catalog_score_audit_entries.definitionKey',
        to: 'chore_catalog_definitions.stableKey',
      },
    },
  };
}
