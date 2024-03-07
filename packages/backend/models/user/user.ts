import { Model } from 'objection';
import { RJSFSchema } from '@rjsf/utils';

export default class User extends Model {
  id!: number;

  googleID!: string;

  firstName!: string;

  lastName!: string;

  playaName = '';

  email!: string;

  phoneNumber!: string;

  location!: string;

  referralName = '';

  skillsOfNote: string[] = [];

  skillsNotInList = '';

  // Table name is the only required property.
  static tableName = 'users';

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
    title: 'Edit Your Profile',
    type: 'object',
    required: [
      'firstName',
      'lastName',
      'phoneNumber',
      'location',
      'skillsOfNote',
    ],
    properties: {
      firstName: { type: 'string', title: 'First Name', default: 'Sparkles' },
      lastName: { type: 'string', title: 'Last Name', default: 'McAfee' },
      playaName: { type: 'string', title: 'Playa Name', default: '' },
      phoneNumber: {
        type: 'string',
        title: 'Phone Number',
        default: '',
        format: 'phone',
      },
      location: {
        type: 'string',
        title: 'Where do you live?',
        default: '',
      },
      referralName: {
        type: 'string',
        title: 'Referral Name',
        default: '',
      },
      skillsOfNote: {
        type: 'array',
        title: 'Skills of Note',
        uniqueItems: true,
        items: {
          type: ['string', 'null'],
          enum: [
            'General organization (read: has OCD)',
            'Project mgmt',
            'Cooking',
            'Meal prep',
            'Recipe planning',
            'Washing dishes',
            'Bartending, mixology',
            'Keg operation',
            'Art things (painting, etc)',
            'Graphic design',
            'Social media / content',
            'Web admin',
            'Soldering & electronics',
            'Rigging',
            'Bike knowledge',
            'Lighting & projection',
            'Propane & flame effects',
            'Chainsaws',
            'Sound, audio',
            'Electrical grid & generators',
            'Coding & computadors',
            'DJing',
            'General Contractor, PowerTools, Lagbolts, Ratchetstraps',
            'Fire safety',
            "Caring about others' comfort (e.g., camp shower, chill dome, general fluffing)",
            'Being tall',
            "Being large (e.g., 'muscle')",
            'Being loud (e.g., heckling)',
            'Walking with CinderBlock Shoes',
            'Marrying people',
          ],
        },
      },
      skillsNotInList: {
        type: 'string',
        title: 'Skills Not In List',
        default: 'Valiant Device #1',
      },
    },
  };

  displayName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
