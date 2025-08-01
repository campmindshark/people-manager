import { Model } from 'objection';
import User from '../user/user';
import Roster from '../roster/roster';

export default class DuesPayment extends Model {
  id!: number;

  userID!: number;

  rosterID!: number;

  paid = false;

  amount?: string;

  paymentMethod?: string;

  paymentDate?: Date;

  createdAt!: Date;

  updatedAt!: Date;

  static tableName = 'dues_payments';

  static jsonSchema = {
    type: 'object',
    required: ['userID', 'rosterID'],

    properties: {
      id: { type: 'integer' },
      userID: { type: 'integer' },
      rosterID: { type: 'integer' },
      paid: { type: 'boolean' },
      amount: { type: 'string' },
      paymentMethod: { type: 'string' },
      paymentDate: { type: 'string', format: 'date-time' },
    },
  };

  static relationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'dues_payments.userID',
        to: 'users.id',
      },
    },
    roster: {
      relation: Model.BelongsToOneRelation,
      modelClass: Roster,
      join: {
        from: 'dues_payments.rosterID',
        to: 'rosters.id',
      },
    },
  };
}