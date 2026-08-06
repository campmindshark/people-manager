import { Knex } from 'knex';

interface CountRow {
  count: string;
}

export async function up(knex: Knex): Promise<void> {
  const existingPlanCount = (await knex('chore_plans')
    .count('* as count')
    .first()) as CountRow | undefined;
  if (Number(existingPlanCount?.count ?? 0) !== 0) {
    throw new Error(
      'Draft persistence requires the new chore_plans table to be empty.',
    );
  }

  await knex.schema.alterTable('chore_plans', (table) => {
    table.integer('planningYear').notNullable();
    table.integer('camperCount').notNullable();
    table.smallint('choreRequirement').notNullable();
    table.smallint('eventRequirement').notNullable();
    table.smallint('dinnerRequirement').notNullable();
    table.bigInteger('catalogRevision').notNullable();
    table.bigInteger('draftRevision').notNullable().defaultTo(1);
    table.text('generationHash').notNullable();
  });

  await knex.raw(`
    ALTER TABLE "chore_plans"
    ADD CONSTRAINT "chore_plans_draft_inputs_valid"
    CHECK (
      "planningYear" BETWEEN 2000 AND 2200
      AND "camperCount" BETWEEN 1 AND 200
      AND "choreRequirement" BETWEEN 0 AND 20
      AND "eventRequirement" BETWEEN 0 AND 20
      AND "dinnerRequirement" BETWEEN 0 AND 20
      AND "catalogRevision" >= 1
      AND "draftRevision" >= 1
      AND "generationHash" ~ '^[0-9a-f]{64}$'
    )
  `);

  await knex.schema.alterTable('schedules', (table) => {
    table.integer('chorePlanID').nullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('RESTRICT');
    table.text('plannerKey').nullable();
    table.unique(
      ['chorePlanID', 'plannerKey'],
      'schedules_chore_plan_key_unique_v2',
    );
  });

  await knex.raw(`
    ALTER TABLE "schedules"
    ADD CONSTRAINT "schedules_chore_plan_ownership_consistent"
    CHECK (
      ("chorePlanID" IS NULL AND "plannerKey" IS NULL)
      OR (
        "chorePlanID" IS NOT NULL
        AND "plannerKey" IS NOT NULL
        AND btrim("plannerKey") <> ''
      )
    )
  `);

  await knex.schema.alterTable('shifts', (table) => {
    table.text('plannerKey').nullable();
    table.unique(
      ['scheduleID', 'plannerKey'],
      'shifts_schedule_planner_key_unique_v2',
    );
  });

  await knex.raw(`
    ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_planner_key_present"
    CHECK ("plannerKey" IS NULL OR btrim("plannerKey") <> '')
  `);

  await knex.schema.createTable('chore_plan_generated_shifts', (table) => {
    table.integer('shiftID').primary();
    table.foreign('shiftID').references('shifts.id').onDelete('CASCADE');
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.text('stableKey').notNullable();
    table.text('scheduleKey').notNullable();
    table.text('kind').notNullable();
    table.text('scheduleName').notNullable();
    table.smallint('displayDayNumber').notNullable();
    table.text('displayDayLabel').notNullable();
    table.smallint('calendarDay').notNullable();
    table.text('timePeriodLabel').notNullable();
    table.integer('periodOrder').nullable();
    table.specificType('totalScore', 'numeric').notNullable();
    table.unique(
      ['chorePlanID', 'stableKey'],
      'chore_plan_generated_shifts_plan_key_unique',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_plan_generated_shifts"
    ADD CONSTRAINT "chore_plan_generated_shifts_metadata_valid"
    CHECK (
      btrim("stableKey") <> ''
      AND btrim("scheduleKey") <> ''
      AND "kind" IN ('chore', 'event', 'dinner')
      AND btrim("scheduleName") <> ''
      AND "displayDayNumber" BETWEEN 1 AND 7
      AND btrim("displayDayLabel") <> ''
      AND "calendarDay" BETWEEN 1 AND 8
      AND btrim("timePeriodLabel") <> ''
      AND (
        ("kind" = 'event' AND "periodOrder" IS NOT NULL AND "periodOrder" > 0)
        OR ("kind" IN ('chore', 'dinner') AND "periodOrder" IS NULL)
      )
      AND "totalScore" >= 0
      AND scale("totalScore") <= 2
    )
  `);

  await knex.schema.createTable('chore_plan_slot_snapshots', (table) => {
    table.increments('id').primary();
    table.integer('shiftID').notNullable();
    table
      .foreign('shiftID')
      .references('shiftID')
      .inTable('chore_plan_generated_shifts')
      .onDelete('CASCADE');
    table.smallint('slotOrder').notNullable();
    table.text('definitionKey').notNullable();
    table.text('kind').notNullable();
    table.text('shiftLabel').notNullable();
    table.text('positionLabel').notNullable();
    table.text('dayMode').notNullable();
    table.smallint('dayNumber').nullable();
    table.text('dayLabel').nullable();
    table.text('timePeriodLabel').notNullable();
    table.integer('periodOrder').nullable();
    table.time('startLocalTime').notNullable();
    table.time('endLocalTime').notNullable();
    table.smallint('endDayOffset').notNullable();
    table.integer('sourceOrder').notNullable();
    table.specificType('score', 'numeric').notNullable();
    table.unique(
      ['shiftID', 'slotOrder'],
      'chore_plan_slot_snapshots_shift_order_unique',
    );
    table.unique(
      ['shiftID', 'definitionKey'],
      'chore_plan_slot_snapshots_shift_definition_unique',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_plan_slot_snapshots"
    ADD CONSTRAINT "chore_plan_slot_snapshots_metadata_valid"
    CHECK (
      "slotOrder" >= 0
      AND "definitionKey" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      AND "kind" IN ('chore', 'event', 'dinner')
      AND btrim("shiftLabel") <> ''
      AND btrim("positionLabel") <> ''
      AND btrim("timePeriodLabel") <> ''
      AND (
        (
          "kind" = 'chore'
          AND "dayMode" = 'template'
          AND "dayNumber" IS NULL
          AND "dayLabel" IS NULL
          AND "periodOrder" IS NULL
        )
        OR (
          "kind" = 'event'
          AND "dayMode" = 'explicit'
          AND "dayNumber" IS NOT NULL
          AND "dayNumber" BETWEEN 1 AND 7
          AND "dayLabel" IS NOT NULL
          AND btrim("dayLabel") <> ''
          AND "periodOrder" IS NOT NULL
          AND "periodOrder" > 0
        )
        OR (
          "kind" = 'dinner'
          AND "dayMode" = 'explicit'
          AND "dayNumber" IS NOT NULL
          AND "dayNumber" BETWEEN 1 AND 7
          AND "dayLabel" IS NOT NULL
          AND btrim("dayLabel") <> ''
          AND "periodOrder" IS NULL
        )
      )
      AND "endDayOffset" IN (0, 1)
      AND "sourceOrder" >= 0
      AND "score" BETWEEN 0 AND 100
      AND scale("score") <= 2
    )
  `);

  await knex.schema.createTable('chore_plan_audit_entries', (table) => {
    table.increments('id').primary();
    table.integer('chorePlanID').notNullable();
    table
      .foreign('chorePlanID')
      .references('chore_plans.id')
      .onDelete('CASCADE');
    table.integer('actorUserID').notNullable();
    table.foreign('actorUserID').references('users.id');
    table.text('action').notNullable();
    table.jsonb('details').notNullable();
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(
      ['chorePlanID', 'createdAt'],
      'chore_plan_audit_entries_plan_time_index',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_plan_audit_entries"
    ADD CONSTRAINT "chore_plan_audit_entries_action_valid"
    CHECK ("action" IN ('draft_applied', 'draft_replaced')),
    ADD CONSTRAINT "chore_plan_audit_entries_details_object"
    CHECK (jsonb_typeof("details") = 'object')
  `);
}

// Persisted drafts and their audit history are application data. Any future
// schema replacement must use a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.resolve();
}
