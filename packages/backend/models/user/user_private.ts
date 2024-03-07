import { Model } from 'objection';
import { RJSFSchema } from '@rjsf/utils';

export default class PrivateProfile extends Model {
  id!: number;

  userID!: number;

  emergencyContactName!: string;

  emergencyContactPhone!: string;

  medications = '';

  allergies = '';

  dietaryRestrictions = '';

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

  static formSchema: RJSFSchema = {
    title: 'Edit Your Private Profile',
    type: 'object',
    required: [
      'emergencyContactName',
      'emergencyContactPhone',
      'medications',
      'allergies',
      'dietaryRestrictions',
    ],
    properties: {
      emergencyContactName: {
        type: 'string',
        title: 'Emergency Contact Name',
        default: '',
      },
      emergencyContactPhone: {
        type: 'string',
        title: 'Emergency Contact Phone',
        default: '',
      },
      medications: {
        type: 'string',
        title: 'Medications',
        default: '',
      },
      allergies: {
        type: 'string',
        title: 'Allergies',
        default: '',
      },
      dietaryRestrictions: {
        type: 'string',
        title: 'Dietary Restrictions',
        default: '',
      },
    },
  };
}
