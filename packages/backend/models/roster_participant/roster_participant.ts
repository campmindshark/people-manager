import { Model } from 'objection';
import User from '../user/user';
import { FIRST_MINDSHARK_YEAR } from '../../utils/campYears';

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

  // Tells Objection these columns hold JSON; serialized on write, parsed on
  // read. Required so jsonSchema can validate yearsAtCamp as an array (rather
  // than after a manual JSON.stringify in the route).
  static jsonAttributes = ['yearsAtCamp'];

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
      yearsAtCamp: {
        type: 'array',
        uniqueItems: true,
        items: {
          type: 'integer',
          minimum: FIRST_MINDSHARK_YEAR,
          not: { const: 2020 },
        },
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
