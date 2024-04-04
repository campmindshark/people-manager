import { Model } from 'objection';

export default class UserVerification extends Model {
  id!: number;

  userID!: number;

  isVerified = false;

  // Table name is the only required property.
  static tableName = 'user_verifications';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',

    properties: {
      userID: { type: 'integer' },
    },
  };
}
