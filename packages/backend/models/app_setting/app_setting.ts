import { Model } from 'objection';

export default class AppSetting extends Model {
  id!: number;

  key!: string;

  value!: string;

  static tableName = 'app_settings';

  static jsonSchema = {
    type: 'object',
    required: ['key', 'value'],

    properties: {
      id: { type: 'integer' },
      key: { type: 'string', minLength: 1, maxLength: 255 },
      value: { type: 'string', minLength: 1, maxLength: 2048 },
    },
  };
}
