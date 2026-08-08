import { Knex } from 'knex';
import { CHORE_CATALOG_V2 } from './data/chore_catalog_v2';

interface CountRow {
  count: string;
}

async function rowCount(knex: Knex, tableName: string): Promise<number> {
  const result = (await knex(tableName).count('* as count').first()) as
    CountRow | undefined;
  return Number(result?.count ?? 0);
}

export async function up(knex: Knex): Promise<void> {
  const [planCount, scoreAuditCount, definitionCount, scoreCount] =
    await Promise.all([
      rowCount(knex, 'chore_plans'),
      rowCount(knex, 'chore_catalog_score_audit_entries'),
      rowCount(knex, 'chore_catalog_definitions'),
      rowCount(knex, 'chore_catalog_scores'),
    ]);

  if (planCount !== 0 || scoreAuditCount !== 0) {
    throw new Error(
      'Excluding the 3a-6a event period requires no chore plans or catalog score audit history.',
    );
  }
  if (![302, 326].includes(definitionCount) || definitionCount !== scoreCount) {
    throw new Error(
      'Excluding the 3a-6a event period requires the reviewed catalog boundary.',
    );
  }

  const excludedDefinitionCount = Number(
    (
      (await knex('chore_catalog_definitions')
        .where({ kind: 'event' })
        .whereRaw(
          `regexp_replace(lower("timePeriodLabel"), '[[:space:]m]', '', 'g') = '3a-6a'`,
        )
        .count('* as count')
        .first()) as CountRow | undefined
    )?.count ?? 0,
  );
  if (
    (definitionCount === 326 && excludedDefinitionCount !== 24) ||
    (definitionCount === 302 && excludedDefinitionCount !== 0)
  ) {
    throw new Error(
      'The installed catalog does not match the reviewed 3a-6a exclusion boundary.',
    );
  }

  await knex('chore_catalog_scores').delete();
  await knex('chore_catalog_definitions').delete();
  await knex('chore_catalog_definitions').insert(
    CHORE_CATALOG_V2.map(({ score: _score, ...definition }) => definition),
  );
  await knex('chore_catalog_scores').insert(
    CHORE_CATALOG_V2.map(({ stableKey, score }) => ({
      definitionKey: stableKey,
      score,
    })),
  );
  await knex('chore_catalog_state')
    .where({ id: 1 })
    .update({
      ...(definitionCount === 326
        ? { revision: knex.raw('"revision" + 1') }
        : {}),
      updatedAt: knex.fn.now(),
    });

  await knex.raw(`
    ALTER TABLE "chore_catalog_definitions"
    DROP CONSTRAINT IF EXISTS "chore_catalog_definitions_event_period_valid",
    ADD CONSTRAINT "chore_catalog_definitions_event_period_valid"
    CHECK (
      "kind" <> 'event'
      OR regexp_replace(
        lower("timePeriodLabel"),
        '[[:space:]m]',
        '',
        'g'
      ) <> '3a-6a'
    )
  `);
}

// The accepted catalog becomes application data after this migration. Any
// future catalog replacement must use a separately reviewed forward migration.
export function down(_knex: Knex): Promise<void> {
  return Promise.reject(
    new Error(
      '20260806025000_exclude_3a_6a_event_period is forward-only because the accepted catalog becomes application data.',
    ),
  );
}
