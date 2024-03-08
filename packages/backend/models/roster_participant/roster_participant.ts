import { Model } from 'objection';
import User from '../user/user';
import { RJSFSchema, UiSchema } from '@rjsf/utils';

export default class RosterParticipant extends Model {
  id!: number;

  rosterID!: number;

  userID!: number;

  probabilityOfAttending!: number;

  hasTicket!: boolean;

  hasVehiclePass!: boolean;

  extraTickets!: boolean;

  yearsAttended!: number;

  yearsAtCamp: number[] = [];

  estimatedArrivalDate: Date = new Date();

  estimatedDepartureDate: Date = new Date();

  sleepingArrangement: string[] = [];

  earlyArrivalInterest!: boolean;

  postBurnInterest!: boolean;

  // Table name is the only required property.
  static tableName = 'roster_participants';

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

  static formUiSchema: UiSchema = {
    probabilityOfAttending: {
      'ui:widget': 'range',
    },
    yearsAtCamp: {
      'ui:widget': 'checkboxes',
    },
    sleepingArrangement: {
      'ui:enableMarkdownInDescription': true,
      'ui:description':
        '*RVs are not permitted in our camp:* We *do not* have the space per unit person to have RVs in our camp, so that is not an acceptable answer. Modified vehicles (e.g., a school bus from Pimp My Ride) are OK.',
    },
    estimatedDepartureDate: {
      'ui:description':
        'In-camp MANDATORY tear-down occurs at least until 4p on Sunday, September 3th, so it best not be before then.',
    },
  };

  static formSchema: RJSFSchema = {
    type: 'object',
    properties: {
      probabilityOfAttending: {
        type: 'integer',
        title: 'Probability of attending (0-100)',
        minimum: 0,
        maximum: 100,
      },
      hasTicket: {
        type: 'boolean',
        title: 'Do you have a ticket?',
      },
      hasVehiclePass: {
        type: 'boolean',
        title: 'Do you have a vehicle pass?',
      },
      extraTickets: {
        type: 'boolean',
        title: 'Do you have extra tickets?',
      },
      yearsAttended: {
        type: 'integer',
        title: 'How many years have you attended the burn?',
      },
      yearsAtCamp: {
        type: 'array',
        title: 'How many years have you been at this camp?',
        uniqueItems: true,
        items: {
          type: 'integer',
          enum: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2022, 2023],
        },
      },
      estimatedArrivalDate: {
        type: 'string',
        title: 'When do you plan to arrive?',
        format: 'date',
      },
      estimatedDepartureDate: {
        type: 'string',
        title: 'When do you plan to depart?',
        format: 'date',
      },
      sleepingArrangement: {
        type: 'string',
        title: 'What is your sleeping arrangement?',
        enum: [
          'Personal tent - something that requires camp shade',
          "Personal yurt, shift pod, etc - something that doesn't require shade",
          'Other...',
        ],
      },
      earlyArrivalInterest: {
        type: 'boolean',
        title:
          'Are you interested in early arrival? (This is a team of ~30 who arrive Wednesday or Thursday before the gates open to set up the camp and requires a special pass.)',
      },
      postBurnInterest: {
        type: 'boolean',
        title: 'Are you interested in post-burn?',
      },
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
  };
}
