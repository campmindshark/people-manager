import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chore_plan_requirement_overrides', (table) => {
    table.increments('id').primary();
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.integer('userID').notNullable();
    table.foreign('userID').references('users.id').onDelete('CASCADE');
    table.smallint('choreRequirement').notNullable();
    table.smallint('eventRequirement').notNullable();
    table.smallint('dinnerRequirement').notNullable();
    table.text('reason').notNullable();
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(
      ['chorePlanID', 'userID'],
      'chore_plan_requirement_overrides_plan_user_unique_v2',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_plan_requirement_overrides"
    ADD CONSTRAINT "chore_plan_requirement_overrides_values_valid_v2"
    CHECK (
      "choreRequirement" BETWEEN 0 AND 20
      AND "eventRequirement" BETWEEN 0 AND 20
      AND "dinnerRequirement" BETWEEN 0 AND 20
      AND char_length(btrim("reason")) BETWEEN 1 AND 500
    )
  `);

  await knex.raw(`
    CREATE FUNCTION validate_chore_plan_requirement_override_v2()
    RETURNS trigger AS $$
    DECLARE
      plan_record RECORD;
    BEGIN
      -- Serialize direct plan and override writes on their shared plan row.
      SELECT "choreRequirement", "eventRequirement", "dinnerRequirement"
      INTO plan_record
      FROM "chore_plans"
      WHERE "id" = NEW."chorePlanID"
      FOR UPDATE;

      IF FOUND AND (
        NEW."choreRequirement" > plan_record."choreRequirement"
        OR NEW."eventRequirement" > plan_record."eventRequirement"
        OR NEW."dinnerRequirement" > plan_record."dinnerRequirement"
      ) THEN
        RAISE EXCEPTION 'Participant requirements may not exceed plan requirements.'
          USING ERRCODE = '23514',
            CONSTRAINT = 'chore_plan_requirement_overrides_plan_maximum_v2';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER "chore_plan_requirement_overrides_plan_maximum_v2"
    BEFORE INSERT OR UPDATE OF
      "chorePlanID",
      "choreRequirement",
      "eventRequirement",
      "dinnerRequirement"
    ON "chore_plan_requirement_overrides"
    FOR EACH ROW EXECUTE FUNCTION validate_chore_plan_requirement_override_v2()
  `);

  await knex.raw(`
    CREATE FUNCTION validate_chore_plan_requirement_maxima_v2()
    RETURNS trigger AS $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM "chore_plan_requirement_overrides" AS override
        WHERE override."chorePlanID" = NEW."id"
          AND (
            override."choreRequirement" > NEW."choreRequirement"
            OR override."eventRequirement" > NEW."eventRequirement"
            OR override."dinnerRequirement" > NEW."dinnerRequirement"
          )
      ) THEN
        RAISE EXCEPTION 'Plan requirements may not be reduced below participant overrides.'
          USING ERRCODE = '23514',
            CONSTRAINT = 'chore_plans_requirement_override_maxima_v2';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER "chore_plans_requirement_override_maxima_v2"
    BEFORE UPDATE OF
      "choreRequirement",
      "eventRequirement",
      "dinnerRequirement"
    ON "chore_plans"
    FOR EACH ROW EXECUTE FUNCTION validate_chore_plan_requirement_maxima_v2()
  `);

  await knex.raw(`
    CREATE FUNCTION validate_chore_plan_removed_assignments_v2(
      audit_action text,
      removed_assignments jsonb
    )
    RETURNS boolean AS $$
    DECLARE
      removed_assignment jsonb;
    BEGIN
      IF jsonb_typeof(removed_assignments) <> 'array' THEN
        RETURN FALSE;
      END IF;

      IF audit_action = 'participant_requirements_cleared'
        AND removed_assignments <> '[]'::jsonb
      THEN
        RETURN FALSE;
      END IF;

      FOR removed_assignment IN
        SELECT value FROM jsonb_array_elements(removed_assignments)
      LOOP
        IF jsonb_typeof(removed_assignment) <> 'object' THEN
          RETURN FALSE;
        END IF;
        IF NOT (
          jsonb_exists(removed_assignment, 'shiftID')
          AND jsonb_exists(removed_assignment, 'stableKey')
          AND jsonb_exists(removed_assignment, 'kind')
          AND removed_assignment - ARRAY[
            'shiftID',
            'stableKey',
            'kind'
          ]::text[] = '{}'::jsonb
        ) THEN
          RETURN FALSE;
        END IF;
        IF jsonb_typeof(removed_assignment -> 'shiftID') <> 'number'
          OR (removed_assignment ->> 'shiftID') !~ '^[1-9][0-9]*$'
          OR jsonb_typeof(removed_assignment -> 'stableKey') <> 'string'
          OR btrim(removed_assignment ->> 'stableKey') = ''
          OR jsonb_typeof(removed_assignment -> 'kind') <> 'string'
          OR removed_assignment ->> 'kind' NOT IN (
            'chore',
            'event',
            'dinner'
          )
        THEN
          RETURN FALSE;
        END IF;
      END LOOP;

      RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE STRICT;
  `);

  await knex.raw(`
    ALTER TABLE "chore_plan_audit_entries"
    DROP CONSTRAINT "chore_plan_audit_entries_action_valid",
    ADD CONSTRAINT "chore_plan_audit_entries_action_valid"
    CHECK (
      "action" IN (
        'draft_applied',
        'draft_replaced',
        'plan_opened',
        'plan_closed',
        'plan_reopened',
        'admin_assignment_mutated',
        'participant_requirements_overridden',
        'participant_requirements_cleared'
      )
    ),
    ADD CONSTRAINT "chore_plan_audit_entries_requirement_details_valid"
    CHECK (
      "action" NOT IN (
        'participant_requirements_overridden',
        'participant_requirements_cleared'
      )
      OR (
        jsonb_typeof("details") = 'object'
        AND jsonb_exists("details", 'participantUserID')
        AND jsonb_exists("details", 'previousRequirements')
        AND jsonb_exists("details", 'requirements')
        AND jsonb_exists("details", 'previousReason')
        AND jsonb_exists("details", 'reason')
        AND jsonb_exists("details", 'removedAssignments')
        AND "details" - ARRAY[
          'participantUserID',
          'previousRequirements',
          'requirements',
          'previousReason',
          'reason',
          'removedAssignments'
        ]::text[] = '{}'::jsonb
        AND jsonb_typeof("details" -> 'participantUserID') = 'number'
        AND ("details" ->> 'participantUserID') ~ '^[1-9][0-9]*$'
        AND jsonb_typeof("details" -> 'requirements') = 'object'
        AND jsonb_exists("details" -> 'requirements', 'chore')
        AND jsonb_exists("details" -> 'requirements', 'event')
        AND jsonb_exists("details" -> 'requirements', 'dinner')
        AND ("details" -> 'requirements') - ARRAY[
          'chore',
          'event',
          'dinner'
        ]::text[] = '{}'::jsonb
        AND jsonb_typeof("details" -> 'requirements' -> 'chore') = 'number'
        AND ("details" -> 'requirements' ->> 'chore')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND jsonb_typeof("details" -> 'requirements' -> 'event') = 'number'
        AND ("details" -> 'requirements' ->> 'event')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND jsonb_typeof("details" -> 'requirements' -> 'dinner') = 'number'
        AND ("details" -> 'requirements' ->> 'dinner')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND jsonb_typeof("details" -> 'previousRequirements') = 'object'
        AND jsonb_exists("details" -> 'previousRequirements', 'chore')
        AND jsonb_exists("details" -> 'previousRequirements', 'event')
        AND jsonb_exists("details" -> 'previousRequirements', 'dinner')
        AND ("details" -> 'previousRequirements') - ARRAY[
          'chore',
          'event',
          'dinner'
        ]::text[] = '{}'::jsonb
        AND jsonb_typeof(
          "details" -> 'previousRequirements' -> 'chore'
        ) = 'number'
        AND ("details" -> 'previousRequirements' ->> 'chore')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND jsonb_typeof(
          "details" -> 'previousRequirements' -> 'event'
        ) = 'number'
        AND ("details" -> 'previousRequirements' ->> 'event')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND jsonb_typeof(
          "details" -> 'previousRequirements' -> 'dinner'
        ) = 'number'
        AND ("details" -> 'previousRequirements' ->> 'dinner')
          ~ '^(0|[1-9]|1[0-9]|20)$'
        AND (
          "details" -> 'previousReason' = 'null'::jsonb
          OR (
            jsonb_typeof("details" -> 'previousReason') = 'string'
            AND char_length(btrim("details" ->> 'previousReason')) BETWEEN 1 AND 500
          )
        )
        AND jsonb_typeof("details" -> 'reason') = 'string'
        AND char_length(btrim("details" ->> 'reason')) BETWEEN 1 AND 500
        AND validate_chore_plan_removed_assignments_v2(
          "action",
          "details" -> 'removedAssignments'
        )
      )
    )
  `);
}

// Requirement overrides and their audit history are application data. Any
// replacement must use a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806050000_chore_plan_requirement_overrides is forward-only because overrides and audit history are application data.',
    ),
  );
}
