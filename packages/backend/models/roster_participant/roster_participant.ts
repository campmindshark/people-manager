import { Model } from 'objection';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import User from '../user/user';

export default class RosterParticipant extends Model {
  id!: number;

  rosterID!: number;

  userID!: number;

  probabilityOfAttending!: number;

  hasTicket = false;

  hasVehiclePass = false;

  extraTickets = false;

  yearsAttended!: number;

  yearsAtCamp: number[] = [];

  estimatedArrivalDate!: Date;

  estimatedDepartureDate!: Date;

  sleepingArrangement!: string;

  earlyArrivalInterest = false;

  postBurnInterest = false;

  hasReadEssentialMindshark = false;

  agreesToParticipateInTearDown = false;

  agreesToParticipateInShifts = false;

  agreesToPayDues = false;

  // Table name is the only required property.
  static tableName = 'roster_participants';

  // Optional JSON schema. This is not the database schema! Nothing is generated
  // based on this. This is only used for validation. Whenever a model instance
  // is created it is checked against this schema. http://json-schema.org/.
  static jsonSchema = {
    type: 'object',
    required: [
      'probabilityOfAttending',
      'estimatedArrivalDate',
      'estimatedDepartureDate',
      'sleepingArrangement',
    ],

    properties: {
      id: { type: 'integer' },
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
        'In-camp MANDATORY tear-down occurs at least until 4p on Sunday, August 31st, so it best not be before then.',
    },
    hasReadEssentialMindshark: {
      'ui:description':
        'You must read The Essential Mindshark to camp with MindShark.',
    },
    agreesToParticipateInTearDown: {
      'ui:description':
        'You must agree to participate in camp tear-down to camp with MindShark.',
    },
    agreesToParticipateInShifts: {
      'ui:description':
        'You must agree to participate in camp shifts to camp with MindShark.',
    },
    agreesToPayDues: {
      'ui:description':
        'You must agree to pay camp dues to camp with MindShark.',
    },
  };

  static formSchema: RJSFSchema = {
    type: 'object',
    required: [
      'probabilityOfAttending',
      'estimatedArrivalDate',
      'estimatedDepartureDate',
      'sleepingArrangement',
      'hasReadEssentialMindshark',
      'agreesToParticipateInTearDown',
      'agreesToParticipateInShifts',
      'agreesToPayDues',
    ],
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
        title: 'How many years have you camped with MindShark?',
        uniqueItems: true,
        items: {
          type: 'integer',
          enum: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2022, 2023, 2024],
        },
      },
      estimatedArrivalDate: {
        type: 'string',
        title: 'When do you plan to arrive? (Gates open Sunday, August 24th)',
        format: 'date-time',
      },
      estimatedDepartureDate: {
        type: 'string',
        title: 'When do you plan to depart? (Temple burns Sunday, August 31st)',
        format: 'date-time',
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
      hasReadEssentialMindshark: {
        type: 'boolean',
        title: 'I have read the essential MindShark. (https://rb.gy/v5f6dw)',
      },
      agreesToParticipateInTearDown: {
        type: 'boolean',
        title: 'I agree to participate in the camp tear-down.',
      },
      agreesToParticipateInShifts: {
        type: 'boolean',
        title: 'I agree to participate in camp shifts.',
      },
      agreesToPayDues: {
        type: 'boolean',
        title: 'I agree to pay camp dues.',
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
