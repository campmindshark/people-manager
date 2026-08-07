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
      SELECT "choreRequirement", "eventRequirement", "dinnerRequirement"
      INTO plan_record
      FROM "chore_plans"
      WHERE "id" = NEW."chorePlanID";

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
        AND "details" - ARRAY[
          'participantUserID',
          'previousRequirements',
          'requirements',
          'previousReason',
          'reason'
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
        AND (
          "details" -> 'previousRequirements' = 'null'::jsonb
          OR (
            jsonb_typeof("details" -> 'previousRequirements') = 'object'
            AND jsonb_exists("details" -> 'previousRequirements', 'chore')
            AND jsonb_exists("details" -> 'previousRequirements', 'event')
            AND jsonb_exists("details" -> 'previousRequirements', 'dinner')
            AND ("details" -> 'previousRequirements') - ARRAY[
              'chore',
              'event',
              'dinner'
            ]::text[] = '{}'::jsonb
          )
        )
        AND (
          "details" -> 'previousReason' = 'null'::jsonb
          OR (
            jsonb_typeof("details" -> 'previousReason') = 'string'
            AND char_length(btrim("details" ->> 'previousReason')) BETWEEN 1 AND 500
          )
        )
        AND jsonb_typeof("details" -> 'reason') = 'string'
        AND char_length(btrim("details" ->> 'reason')) BETWEEN 1 AND 500
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
