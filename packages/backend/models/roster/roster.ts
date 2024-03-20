import { Model } from 'objection';
import User from '../user/user';
import Schedule from '../schedule/schedule';

export default class Roster extends Model {
  id!: number;

  year!: number;

  // Table name is the only required property.
  static tableName = 'rosters';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'integer' },
    },
  };

  static relationMappings = {
    participants: {
      relation: Model.ManyToManyRelation,
      modelClass: User,
      join: {
        from: 'rosters.id',
        through: {
          // roster_participants is the join table.
          from: 'roster_participants.rosterID',
          to: 'roster_participants.userID',
        },
        to: 'users.id',
      },
    },
    schedules: {
      relation: Model.HasManyRelation,
      modelClass: Schedule,
      join: {
        from: 'rosters.id',
        to: 'schedules.rosterID',
      },
    },
  };
}
