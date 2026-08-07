const fs = require('node:fs');
const { createHash } = require('node:crypto');
const createKnex = require('knex');

const expectedMigrationNames = [
  '20260806000000_chore_planning_foundation.ts',
  '20260806010000_chore_catalog_score_audit.ts',
  '20260806020000_chore_draft_persistence.ts',
  '20260806030000_chore_plan_lifecycle.ts',
  '20260806040000_chore_plan_admin_assignments.ts',
  '20260806050000_chore_plan_requirement_overrides.ts',
];
const expectedDefinitionCounts = {
  chore: 32,
  event: 240,
  dinner: 54,
};
const expectedStableKeySHA256 =
  'f3d351821a204531152f119f9c5fb61615631dde1b30193d4bea9687b58bfddf';

const connectionString = process.env.POSTGRES_CONNECTION_URL;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_URL is required for the release audit.');
}

const rosterIDValue = process.env.CHORE_RELEASE_ROSTER_ID;
const rosterID = rosterIDValue === undefined ? null : Number(rosterIDValue);
if (
  rosterIDValue !== undefined &&
  (!/^\d+$/.test(rosterIDValue) ||
    !Number.isSafeInteger(rosterID) ||
    rosterID < 1)
) {
  throw new Error('CHORE_RELEASE_ROSTER_ID must be a positive integer.');
}

const database = createKnex({
  client: 'postgresql',
  connection:
    process.env.NODE_ENV === 'production'
      ? {
          connectionString,
          ssl: {
            ca: fs.readFileSync(
              '/usr/local/certs/ca-certificates/us-west-2-bundle.pem',
              'utf8',
            ),
          },
        }
      : connectionString,
  pool: { max: 1, min: 0 },
});

function printResult(label, value) {
  console.log(`CHORE RELEASE AUDIT - ${label}`);
  console.log(JSON.stringify(value));
}

async function runAudit() {
  await database.transaction(async (transaction) => {
    await transaction.raw(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );

    const migrations = await transaction('knex_migrations')
      .select('name', 'batch', 'migration_time')
      .whereIn('name', expectedMigrationNames)
      .orderBy('name');
    const installedMigrationNames = new Set(migrations.map(({ name }) => name));
    const missingMigrations = expectedMigrationNames.filter(
      (name) => !installedMigrationNames.has(name),
    );
    printResult('REBUILD MIGRATIONS', migrations);
    if (missingMigrations.length > 0) {
      throw new Error(
        `Missing rebuilt chore migrations: ${missingMigrations.join(', ')}`,
      );
    }

    const definitionCountRows = await transaction('chore_catalog_definitions')
      .select('kind')
      .count('* as count')
      .groupBy('kind')
      .orderBy('kind');
    const definitionCounts = Object.fromEntries(
      definitionCountRows.map(({ kind, count }) => [kind, Number(count)]),
    );
    printResult('CATALOG DEFINITION COUNTS', definitionCounts);
    Object.entries(expectedDefinitionCounts).forEach(([kind, count]) => {
      if (definitionCounts[kind] !== count) {
        throw new Error(
          `Expected ${count} ${kind} definitions, found ${definitionCounts[kind] ?? 0}.`,
        );
      }
    });
    const stableKeyRows = await transaction('chore_catalog_definitions')
      .select('stableKey')
      .orderBy('stableKey');
    const stableKeySHA256 = createHash('sha256')
      .update(stableKeyRows.map(({ stableKey }) => stableKey).join('\n'))
      .digest('hex');
    printResult('CATALOG STABLE KEY SHA-256', stableKeySHA256);
    if (stableKeySHA256 !== expectedStableKeySHA256) {
      throw new Error('The installed fixed catalog key set is unexpected.');
    }

    const catalogState = await transaction('chore_catalog_state')
      .select('revision')
      .where({ id: 1 })
      .first();
    const scoreCount = Number(
      (await transaction('chore_catalog_scores').count('* as count').first())
        ?.count ?? 0,
    );
    const scoreAuditCount = Number(
      (
        await transaction('chore_catalog_score_audit_entries')
          .count('* as count')
          .first()
      )?.count ?? 0,
    );
    printResult('CATALOG STATE', {
      revision: String(catalogState?.revision ?? ''),
      scoreCount,
      scoreAuditCount,
    });
    if (!catalogState || scoreCount !== 326) {
      throw new Error('The fixed catalog state or score rows are incomplete.');
    }

    const planSummaryResult = await transaction.raw(
      `
        SELECT
          plan.id AS "planID",
          plan."rosterID",
          plan.status,
          plan."catalogRevision"::text AS "catalogRevision",
          plan."draftRevision"::text AS "draftRevision",
          (
            SELECT COUNT(*)::integer
            FROM schedules
            WHERE schedules."chorePlanID" = plan.id
          ) AS "scheduleCount",
          (
            SELECT COUNT(*)::integer
            FROM chore_plan_generated_shifts AS generated
            WHERE generated."chorePlanID" = plan.id
          ) AS "shiftCount",
          (
            SELECT COUNT(*)::integer
            FROM chore_plan_slot_snapshots AS slot
            INNER JOIN chore_plan_generated_shifts AS generated
              ON generated."shiftID" = slot."shiftID"
            WHERE generated."chorePlanID" = plan.id
          ) AS "slotCount",
          (
            SELECT COUNT(*)::integer
            FROM shift_participants AS assignment
            INNER JOIN chore_plan_generated_shifts AS generated
              ON generated."shiftID" = assignment."shiftID"
            WHERE generated."chorePlanID" = plan.id
          ) AS "assignmentCount",
          (
            SELECT COUNT(*)::integer
            FROM chore_plan_requirement_overrides AS requirement_override
            WHERE requirement_override."chorePlanID" = plan.id
          ) AS "overrideCount"
        FROM chore_plans AS plan
        WHERE (?::integer IS NULL OR plan."rosterID" = ?::integer)
        ORDER BY plan."rosterID"
      `,
      [rosterID, rosterID],
    );
    printResult('PLAN SUMMARIES', planSummaryResult.rows);
    if (rosterID !== null && planSummaryResult.rows.length !== 1) {
      throw new Error(`No chore plan exists for roster ${rosterID}.`);
    }

    const planAuditResult = await transaction.raw(
      `
        SELECT
          plan."rosterID",
          audit.action,
          COUNT(*)::integer AS count,
          COUNT(*) FILTER (
            WHERE audit.action = 'admin_assignment_mutated'
              AND audit.details ->> 'forced' = 'true'
          )::integer AS "forcedCount"
        FROM chore_plan_audit_entries AS audit
        INNER JOIN chore_plans AS plan ON plan.id = audit."chorePlanID"
        WHERE (?::integer IS NULL OR plan."rosterID" = ?::integer)
        GROUP BY plan."rosterID", audit.action
        ORDER BY plan."rosterID", audit.action
      `,
      [rosterID, rosterID],
    );
    printResult('PLAN AUDIT COUNTS', planAuditResult.rows);
  });
}

runAudit()
  .then(() => {
    console.log('CHORE RELEASE AUDIT - COMPLETE (READ ONLY)');
  })
  .catch((error) => {
    console.error('CHORE RELEASE AUDIT - FAILED');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
