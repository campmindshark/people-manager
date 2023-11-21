import { Model } from 'objection';
import Shift from '../shift/shift';

export default class Schedule extends Model {
  id!: number;

  name!: string;

  description!: string;

  constructor(id: number, name: string, description: string) {
    super();
    this.id = id;
    this.name = name;
    this.description = description;
  }

  // Table name is the only required property.
  static tableName = 'schedules';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'integer' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
    },
  };

  static relationMappings = {
    shifts: {
      relation: Model.HasManyRelation,
      modelClass: Shift,
      join: {
        from: 'schedules.id',
        to: 'shifts.scheduleID',
      },
    },
  };
}
