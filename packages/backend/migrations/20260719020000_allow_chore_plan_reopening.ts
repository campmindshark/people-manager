import { Knex } from 'knex';

const CONSTRAINT_NAME = 'chore_plans_lifecycle_consistent';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE "chore_plans"
    DROP CONSTRAINT IF EXISTS "${CONSTRAINT_NAME}"
  `);
  await knex.raw(`
    ALTER TABLE "chore_plans"
    ADD CONSTRAINT "${CONSTRAINT_NAME}"
    CHECK (
      ("status" = 'draft' AND "openedAt" IS NULL AND "closedAt" IS NULL)
      OR ("status" = 'open' AND "openedAt" IS NOT NULL)
      OR ("status" = 'closed' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE "chore_plans"
    DROP CONSTRAINT IF EXISTS "${CONSTRAINT_NAME}"
  `);

  // The terminal lifecycle cannot represent retained close metadata on an
  // open plan, so restore its expected shape before restoring the constraint.
  await knex('chore_plans')
    .where('status', 'open')
    .whereNotNull('closedAt')
    .update({ closedAt: null, closedByUserID: null });

  await knex.raw(`
    ALTER TABLE "chore_plans"
    ADD CONSTRAINT "${CONSTRAINT_NAME}"
    CHECK (
      ("status" = 'draft' AND "openedAt" IS NULL AND "closedAt" IS NULL)
      OR ("status" = 'open' AND "openedAt" IS NOT NULL AND "closedAt" IS NULL)
      OR ("status" = 'closed' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL)
    )
  `);
}
