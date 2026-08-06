import { Model } from 'objection';
import { ChorePlanStatus } from '../../domain/chore_planning';
import Roster from '../roster/roster';
import User from '../user/user';

export default class ChorePlan extends Model {
  id!: number;

  rosterID!: number;

  status!: ChorePlanStatus;

  planningYear!: number;

  camperCount!: number;

  choreRequirement!: number;

  eventRequirement!: number;

  dinnerRequirement!: number;

  catalogRevision!: string;

  draftRevision!: string;

  generationHash!: string;

  openedAt!: Date | null;

  openedByUserID!: number | null;

  closedAt!: Date | null;

  closedByUserID!: number | null;

  createdAt!: Date;

  updatedAt!: Date;

  static tableName = 'chore_plans';

  static jsonSchema = {
    type: 'object',
    required: [
      'rosterID',
      'planningYear',
      'camperCount',
      'choreRequirement',
      'eventRequirement',
      'dinnerRequirement',
      'catalogRevision',
      'draftRevision',
      'generationHash',
    ],
    properties: {
      id: { type: 'integer' },
      rosterID: { type: 'integer' },
      status: { enum: ['draft', 'open', 'closed'] },
      planningYear: { type: 'integer', minimum: 2000, maximum: 2200 },
      camperCount: { type: 'integer', minimum: 1, maximum: 200 },
      choreRequirement: { type: 'integer', minimum: 0, maximum: 20 },
      eventRequirement: { type: 'integer', minimum: 0, maximum: 20 },
      dinnerRequirement: { type: 'integer', minimum: 0, maximum: 20 },
      catalogRevision: { type: 'string', pattern: '^[1-9][0-9]*$' },
      draftRevision: { type: 'string', pattern: '^[1-9][0-9]*$' },
      generationHash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      openedByUserID: { type: ['integer', 'null'] },
      closedByUserID: { type: ['integer', 'null'] },
    },
  };

  static relationMappings = {
    roster: {
      relation: Model.BelongsToOneRelation,
      modelClass: Roster,
      join: {
        from: 'chore_plans.rosterID',
        to: 'rosters.id',
      },
    },
    openedBy: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'chore_plans.openedByUserID',
        to: 'users.id',
      },
    },
    closedBy: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'chore_plans.closedByUserID',
        to: 'users.id',
      },
    },
  };
}
