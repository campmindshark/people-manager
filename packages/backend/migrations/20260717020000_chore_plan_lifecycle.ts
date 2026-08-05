import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chore_plans', (table) => {
    table
      .enum('status', ['draft', 'open', 'closed'], {
        useNative: false,
        enumName: 'chore_plan_status',
      })
      .notNullable()
      .defaultTo('draft');
    table.timestamp('openedAt', { useTz: true }).nullable();
    table.integer('openedByUserID').nullable();
    table.foreign('openedByUserID').references('users.id');
    table.timestamp('closedAt', { useTz: true }).nullable();
    table.integer('closedByUserID').nullable();
    table.foreign('closedByUserID').references('users.id');
  });

  // Preserve the legacy signup state and its original opening timestamp.
  await knex('chore_plans')
    .whereNotNull('signupsOpenedAt')
    .update({
      status: 'open',
      openedAt: knex.ref('signupsOpenedAt'),
    });

  await knex.schema.alterTable('chore_plans', (table) => {
    table.dropColumn('signupsOpenedAt');
  });

  await knex.raw(`
    ALTER TABLE "chore_plans"
    ADD CONSTRAINT "chore_plans_lifecycle_consistent"
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
    DROP CONSTRAINT "chore_plans_lifecycle_consistent"
  `);

  await knex.schema.alterTable('chore_plans', (table) => {
    table.timestamp('signupsOpenedAt', { useTz: true }).nullable();
  });
  await knex('chore_plans')
    .where('status', 'open')
    .update({ signupsOpenedAt: knex.ref('openedAt') });

  await knex.schema.alterTable('chore_plans', (table) => {
    table.dropForeign('closedByUserID');
    table.dropForeign('openedByUserID');
    table.dropColumn('closedByUserID');
    table.dropColumn('closedAt');
    table.dropColumn('openedByUserID');
    table.dropColumn('openedAt');
    table.dropColumn('status');
  });
}
