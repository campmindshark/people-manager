import { Knex } from 'knex';
import { CHORE_CATALOG_V1 } from './data/chore_catalog_v1';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chore_plans', (table) => {
    table.increments('id').primary();
    table.integer('rosterID').notNullable().unique();
    table.foreign('rosterID').references('rosters.id');
    table.text('status').notNullable().defaultTo('draft');
    table.timestamp('openedAt', { useTz: true }).nullable();
    table.integer('openedByUserID').nullable();
    table.foreign('openedByUserID').references('users.id');
    table.timestamp('closedAt', { useTz: true }).nullable();
    table.integer('closedByUserID').nullable();
    table.foreign('closedByUserID').references('users.id');
    table
      .timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE "chore_plans"
    ADD CONSTRAINT "chore_plans_status_valid"
    CHECK ("status" IN ('draft', 'open', 'closed')),
    ADD CONSTRAINT "chore_plans_lifecycle_consistent"
    CHECK (
      "status" NOT IN ('draft', 'open', 'closed')
      OR
      (
        (
          "status" = 'draft'
          AND "openedAt" IS NULL
          AND "openedByUserID" IS NULL
          AND "closedAt" IS NULL
          AND "closedByUserID" IS NULL
        )
        OR (
          "status" = 'open'
          AND "openedAt" IS NOT NULL
          AND "openedByUserID" IS NOT NULL
          AND "closedAt" IS NULL
          AND "closedByUserID" IS NULL
        )
        OR (
          "status" = 'closed'
          AND "openedAt" IS NOT NULL
          AND "openedByUserID" IS NOT NULL
          AND "closedAt" IS NOT NULL
          AND "closedByUserID" IS NOT NULL
          AND "closedAt" >= "openedAt"
        )
      )
    )
  `);

  await knex.schema.createTable('chore_catalog_definitions', (table) => {
    table.text('stableKey').primary();
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
    table.unique(
      ['kind', 'sourceOrder'],
      'chore_catalog_definitions_kind_source_order_unique',
    );
  });

  await knex.raw(`
    ALTER TABLE "chore_catalog_definitions"
    ADD CONSTRAINT "chore_catalog_definitions_stable_key_valid"
    CHECK ("stableKey" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT "chore_catalog_definitions_kind_valid"
    CHECK ("kind" IN ('chore', 'event', 'dinner')),
    ADD CONSTRAINT "chore_catalog_definitions_labels_present"
    CHECK (
      btrim("shiftLabel") <> ''
      AND btrim("positionLabel") <> ''
      AND btrim("timePeriodLabel") <> ''
    ),
    ADD CONSTRAINT "chore_catalog_definitions_event_period_valid"
    CHECK (
      "kind" <> 'event'
      OR regexp_replace(
        lower("timePeriodLabel"),
        '[[:space:]m]',
        '',
        'g'
      ) <> '3a-6a'
    ),
    ADD CONSTRAINT "chore_catalog_definitions_day_valid"
    CHECK (
      (
        "kind" = 'chore'
        AND "dayMode" = 'template'
        AND "dayNumber" IS NULL
        AND "dayLabel" IS NULL
      )
      OR (
        "kind" IN ('event', 'dinner')
        AND "dayMode" = 'explicit'
        AND "dayNumber" IS NOT NULL
        AND "dayLabel" IS NOT NULL
        AND btrim("dayLabel") <> ''
        AND (
          ("dayNumber" = 1 AND "dayLabel" = 'Sunday')
          OR ("dayNumber" = 2 AND "dayLabel" = 'Monday')
          OR ("dayNumber" = 3 AND "dayLabel" = 'Tuesday')
          OR ("dayNumber" = 4 AND "dayLabel" = 'Wednesday')
          OR ("dayNumber" = 5 AND "dayLabel" = 'Thursday')
          OR ("dayNumber" = 6 AND "dayLabel" = 'Friday')
          OR ("dayNumber" = 7 AND "dayLabel" = 'Saturday')
          OR (
            "kind" = 'event'
            AND "dayNumber" = 8
            AND "dayLabel" = 'Sunday'
          )
        )
      )
    ),
    ADD CONSTRAINT "chore_catalog_definitions_period_order_valid"
    CHECK (
      (
        "kind" = 'event'
        AND "periodOrder" IS NOT NULL
        AND "periodOrder" > 0
      )
      OR ("kind" IN ('chore', 'dinner') AND "periodOrder" IS NULL)
    ),
    ADD CONSTRAINT "chore_catalog_definitions_end_day_offset_valid"
    CHECK ("endDayOffset" IN (0, 1)),
    ADD CONSTRAINT "chore_catalog_definitions_source_order_valid"
    CHECK ("sourceOrder" >= 0)
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX "chore_catalog_definitions_identity_unique"
    ON "chore_catalog_definitions" (
      "kind",
      "shiftLabel",
      "positionLabel",
      "dayMode",
      COALESCE("dayNumber", 0),
      "timePeriodLabel",
      COALESCE("periodOrder", 0)
    )
  `);

  await knex.schema.createTable('chore_catalog_scores', (table) => {
    table.text('definitionKey').primary();
    table
      .foreign('definitionKey')
      .references('stableKey')
      .inTable('chore_catalog_definitions');
    table.specificType('score', 'numeric').notNullable();
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE "chore_catalog_scores"
    ADD CONSTRAINT "chore_catalog_scores_score_valid"
    CHECK ("score" BETWEEN 0 AND 100 AND scale("score") <= 2)
  `);

  await knex.schema.createTable('chore_catalog_state', (table) => {
    table.smallint('id').primary();
    table.bigInteger('revision').notNullable().defaultTo(1);
    table
      .timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE "chore_catalog_state"
    ADD CONSTRAINT "chore_catalog_state_singleton"
    CHECK ("id" = 1),
    ADD CONSTRAINT "chore_catalog_state_revision_valid"
    CHECK ("revision" >= 1)
  `);

  await knex('chore_catalog_definitions').insert(
    CHORE_CATALOG_V1.map(({ score: _score, ...definition }) => definition),
  );
  await knex('chore_catalog_scores').insert(
    CHORE_CATALOG_V1.map(({ stableKey, score }) => ({
      definitionKey: stableKey,
      score,
    })),
  );
  await knex('chore_catalog_state').insert({ id: 1, revision: 1 });
}

// This migration becomes an application data boundary as soon as scores are
// edited. A future removal must use a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806000000_chore_planning_foundation is forward-only because the catalog becomes application data.',
    ),
  );
}
