import { Model, Modifiers } from 'objection';

export default class PrivateProfile extends Model {
  id!: number;

  userID!: number;

  emergencyContactName!: string;

  emergencyContactPhone!: string;

  medications: string = '';

  allergies: string = '';

  dietaryRestrictions: string = '';

  // Table name is the only required property.
  static tableName = 'private_profiles';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',
    required: ['firstName', 'lastName'],

    properties: {
      id: { type: 'integer' },
      firstName: { type: 'string', minLength: 1, maxLength: 255 },
      lastName: { type: 'string', minLength: 1, maxLength: 255 },
    },
  };
}
