import { Knex } from 'knex';

const FIRST_AFFECTED_ROSTER_YEAR = 2026;
const LEGACY_TIMESTAMP_FORMAT = 'legacy-pacific-reinterpretation';
const ABSOLUTE_TIMESTAMP_FORMAT = 'absolute';
const ABSOLUTE_TIMESTAMP_INPUT = 'absolute-input';
const NORMALIZE_WRITE_FUNCTION = 'normalize_roster_attendance_timestamp_write';
const NORMALIZE_WRITE_TRIGGER =
  'normalize_roster_attendance_timestamp_write_trigger';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('roster_participants', (table) => {
    table
      .string('attendanceTimestampFormat')
      .notNullable()
      .defaultTo(LEGACY_TIMESTAMP_FORMAT);
  });

  // The legacy roster route received absolute ISO timestamps, read their UTC
  // wall clocks, and then reinterpreted those wall clocks as Pacific Time.
  // Restore the original instants for active and future rosters before their
  // attendance windows are enforced, without rewriting historical records
  // that may predate that route behavior.
  await knex('roster_participants')
    .whereIn(
      'rosterID',
      knex('rosters')
        .select('id')
        .where('year', '>=', FIRST_AFFECTED_ROSTER_YEAR),
    )
    .update({
      estimatedArrivalDate: knex.raw(
        "timezone('UTC', timezone('America/Los_Angeles', ??))",
        ['estimatedArrivalDate'],
      ),
      estimatedDepartureDate: knex.raw(
        "timezone('UTC', timezone('America/Los_Angeles', ??))",
        ['estimatedDepartureDate'],
      ),
      attendanceTimestampFormat: ABSOLUTE_TIMESTAMP_FORMAT,
    });

  // The deploy updates ECS before this transactional migration runs, and a
  // rolling deployment can leave old and new tasks alive after it commits.
  // New tasks submit the transient absolute-input marker on every attendance
  // write. Old tasks preserve the stored absolute marker (or receive the
  // legacy default on insert), so the trigger can identify and normalize their
  // values before canonicalizing the row marker back to absolute.
  await knex.raw(`
    CREATE FUNCTION ${NORMALIZE_WRITE_FUNCTION}()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE'
        AND NEW."estimatedArrivalDate" IS NOT DISTINCT FROM OLD."estimatedArrivalDate"
        AND NEW."estimatedDepartureDate" IS NOT DISTINCT FROM OLD."estimatedDepartureDate"
        AND NEW."attendanceTimestampFormat" IS NOT DISTINCT FROM OLD."attendanceTimestampFormat"
      THEN
        RETURN NEW;
      END IF;

      IF NEW."attendanceTimestampFormat" = '${ABSOLUTE_TIMESTAMP_INPUT}' THEN
        NEW."attendanceTimestampFormat" := '${ABSOLUTE_TIMESTAMP_FORMAT}';
        RETURN NEW;
      END IF;

      NEW."estimatedArrivalDate" := timezone(
        'UTC',
        timezone('America/Los_Angeles', NEW."estimatedArrivalDate")
      );
      NEW."estimatedDepartureDate" := timezone(
        'UTC',
        timezone('America/Los_Angeles', NEW."estimatedDepartureDate")
      );
      NEW."attendanceTimestampFormat" := '${ABSOLUTE_TIMESTAMP_FORMAT}';
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER ${NORMALIZE_WRITE_TRIGGER}
    BEFORE INSERT OR UPDATE ON roster_participants
    FOR EACH ROW
    EXECUTE FUNCTION ${NORMALIZE_WRITE_FUNCTION}();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS ${NORMALIZE_WRITE_TRIGGER}
      ON roster_participants;
    DROP FUNCTION IF EXISTS ${NORMALIZE_WRITE_FUNCTION}();
  `);

  await knex('roster_participants')
    .whereIn(
      'rosterID',
      knex('rosters')
        .select('id')
        .where('year', '>=', FIRST_AFFECTED_ROSTER_YEAR),
    )
    .update({
      estimatedArrivalDate: knex.raw(
        "timezone('America/Los_Angeles', timezone('UTC', ??))",
        ['estimatedArrivalDate'],
      ),
      estimatedDepartureDate: knex.raw(
        "timezone('America/Los_Angeles', timezone('UTC', ??))",
        ['estimatedDepartureDate'],
      ),
    });

  await knex.schema.alterTable('roster_participants', (table) => {
    table.dropColumn('attendanceTimestampFormat');
  });
}
