import { Model } from 'objection';
import { RJSFSchema } from '@rjsf/utils';
import User from '../user/user';

export default class Group extends Model {
  id!: number;

  name!: string;

  description!: string;

  rosterID!: number;

  shiftSignupOpenDate!: Date;

  // Table name is the only required property.
  static tableName = 'groups';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'integer' },
    },
  };

  static formSchema: RJSFSchema = {
    title: 'Create a Group',
    type: 'object',
    required: ['name', 'description', 'rosterID', 'shiftSignupOpenDate'],
    properties: {
      name: {
        type: 'string',
        title: 'Group Name',
        default: '',
      },
      description: {
        type: 'string',
        title: 'Description',
        default: '',
      },
      rosterID: {
        type: 'integer',
        title: 'Roster ID',
        default: 0,
      },
      shiftSignupOpenDate: {
        type: 'string',
        title: 'Shift Signup Open Date',
        format: 'date-time',
        default: '',
      },
    },
  };

  static relationMappings = {
    members: {
      relation: Model.ManyToManyRelation,
      modelClass: User,
      join: {
        from: 'groups.id',
        through: {
          from: 'group_members.groupID',
          to: 'group_members.userID',
        },
        to: 'users.id',
      },
    },
  };
}
