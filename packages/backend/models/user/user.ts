import { Model, Modifiers } from 'objection';

export default class User extends Model {
  id!: number;

  firstName!: string;

  lastName!: string;

  email!: string;

  googleID!: string;

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

  displayName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Modifiers are reusable query snippets that can be used in various places.
  static modifiers: Modifiers = {
    // Our example modifier is a semi-dumb fuzzy name match. We split the
    // name into pieces using whitespace and then try to partially match
    // each of those pieces to both the `firstName` and the `lastName`
    // fields.
    searchByName(query, name) {
      const nameParts = name.trim().split(/\s+/);
      const columns = ['firstName', 'lastName'];

      // This `where` simply creates parentheses so that other `where`
      // statements don't get mixed with the these.
      query.where((innerQuery) => {
        nameParts.forEach((namePart: string) => {
          columns.forEach((column) => {
            innerQuery.orWhereRaw('lower(??) like ?', [
              column,
              `${namePart.toLowerCase()}%`,
            ]);
          });
        });
      });
    },
  };
}
