import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(
    'chore_catalog_score_audit_entries',
    (table) => {
      table.increments('id').primary();
      table.integer('actorUserID').notNullable();
      table.foreign('actorUserID').references('users.id');
      table.text('definitionKey').notNullable();
      table
        .foreign('definitionKey')
        .references('stableKey')
        .inTable('chore_catalog_definitions');
      table.specificType('oldScore', 'numeric').notNullable();
      table.specificType('newScore', 'numeric').notNullable();
      table.bigInteger('previousRevision').notNullable();
      table.bigInteger('newRevision').notNullable();
      table
        .timestamp('createdAt', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    },
  );

  await knex.raw(`
    ALTER TABLE "chore_catalog_score_audit_entries"
    ADD CONSTRAINT "chore_catalog_score_audit_scores_valid"
    CHECK (
      "oldScore" BETWEEN 0 AND 100
      AND scale("oldScore") <= 2
      AND "newScore" BETWEEN 0 AND 100
      AND scale("newScore") <= 2
      AND "oldScore" <> "newScore"
    ),
    ADD CONSTRAINT "chore_catalog_score_audit_revisions_valid"
    CHECK (
      "previousRevision" >= 1
      AND "newRevision" = "previousRevision" + 1
    )
  `);
}

// Score history is application audit data. Remove or replace this schema only
// through a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806010000_chore_catalog_score_audit is forward-only because score history is application audit data.',
    ),
  );
}
