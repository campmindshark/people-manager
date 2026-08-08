import { Model } from 'objection';
import { ChorePlanStatus } from '../../domain/chore_planning';
import Roster from '../roster/roster';
import User from '../user/user';

export default class ChorePlan extends Model {
  id!: number;

  rosterID!: number;

  status!: ChorePlanStatus;

  openedAt!: Date | null;

  openedByUserID!: number | null;

  closedAt!: Date | null;

  closedByUserID!: number | null;

  createdAt!: Date;

  updatedAt!: Date;

  static tableName = 'chore_plans';

  static jsonSchema = {
    type: 'object',
    required: ['rosterID'],
    properties: {
      id: { type: 'integer' },
      rosterID: { type: 'integer' },
      status: { enum: ['draft', 'open', 'closed'] },
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
