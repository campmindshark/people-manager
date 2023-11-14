import { Model } from 'objection';
import { start } from 'repl';

export default class Shift extends Model {
  id!: number;

  scheduleID!: number;

  startTime!: Date;

  endTime!: Date;

  constructor(id: number, scheduleID: number, startTime: Date, endTime: Date) {
    super();
    this.id = id;
    this.scheduleID = scheduleID;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  // Table name is the only required property.
  static tableName = 'shifts';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',
    required: ['scheduleID', 'startTime', 'endTime'],

    properties: {
      id: { type: 'integer' },
    },
  };

  static relationMappings = {
    schedule: {
      relation: Model.HasOneRelation,
      modelClass: Shift,
      join: {
        from: 'shifts.scheduleID',
        to: 'schedules.id',
      },
    },
  };

  getLengthMinutes(): number {
    const diff =
      new Date(this.endTime).getTime() - new Date(this.startTime).getTime();
    return Math.floor(diff / 60000);
  }
}
