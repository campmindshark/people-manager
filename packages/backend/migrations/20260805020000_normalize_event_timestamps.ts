import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE shifts
      ALTER COLUMN "startTime" TYPE timestamp with time zone
        USING "startTime" AT TIME ZONE 'UTC',
      ALTER COLUMN "endTime" TYPE timestamp with time zone
        USING "endTime" AT TIME ZONE 'UTC'
  `);

  await knex.raw(`
    ALTER TABLE groups
      ALTER COLUMN "shiftSignupOpenDate" TYPE timestamp with time zone
        USING "shiftSignupOpenDate" AT TIME ZONE 'UTC'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE shifts
      ALTER COLUMN "startTime" TYPE timestamp without time zone
        USING timezone('UTC', "startTime"),
      ALTER COLUMN "endTime" TYPE timestamp without time zone
        USING timezone('UTC', "endTime")
  `);

  await knex.raw(`
    ALTER TABLE groups
      ALTER COLUMN "shiftSignupOpenDate" TYPE timestamp without time zone
        USING timezone('UTC', "shiftSignupOpenDate")
  `);
}
