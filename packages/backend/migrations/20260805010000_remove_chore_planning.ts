import { Knex } from 'knex';

interface ColumnRow {
  columnName: string;
}

interface ConstraintRow {
  constraintName: string;
  constraintType: string;
}

interface ForeignKeyRow {
  constraintName: string;
  foreignColumnName: string;
  foreignTableName: string;
  foreignTableSchema: string;
}

interface IDRow {
  id: number;
}

interface SchemaRow {
  schemaName: string;
}

const FEATURE_TABLE_COLUMNS: Record<string, string[]> = {
  chore_plan_audit_entries: [
    'action',
    'actorName',
    'actorUserID',
    'chorePlanID',
    'createdAt',
    'details',
    'id',
  ],
  chore_plan_requirement_overrides: [
    'chorePlanID',
    'choreRequirement',
    'createdAt',
    'dinnerRequirement',
    'eventRequirement',
    'id',
    'reason',
    'updatedAt',
    'userID',
  ],
  chore_plans: [
    'camperCount',
    'choreRequirement',
    'closedAt',
    'closedByUserID',
    'createdAt',
    'dinnerRequirement',
    'eventRequirement',
    'id',
    'openedAt',
    'openedByUserID',
    'rosterID',
    'sheetTitle',
    'sheetUrl',
    'status',
    'updatedAt',
  ],
};

const SHARED_TABLE_COLUMNS: Record<string, string[]> = {
  schedules: ['chorePlanID', 'id', 'plannerKey'],
  shift_participants: ['shiftID', 'userID'],
  shifts: ['id', 'plannerKey', 'scheduleID'],
};

async function getCurrentSchema(knex: Knex): Promise<string> {
  const result = await knex.raw<{ rows: SchemaRow[] }>(
    'SELECT current_schema() AS "schemaName"',
  );
  const [schema] = result.rows;

  if (!schema?.schemaName) {
    throw new Error(
      'Chore-planning teardown could not determine the current schema.',
    );
  }

  return schema.schemaName;
}

async function getColumns(
  knex: Knex,
  schemaName: string,
  tableName: string,
): Promise<string[]> {
  const rows = (await knex('information_schema.columns')
    .select('column_name as columnName')
    .where({ table_name: tableName, table_schema: schemaName })) as ColumnRow[];

  return rows.map(({ columnName }) => columnName).sort();
}

function assertColumns(
  tableName: string,
  actualColumns: string[],
  expectedColumns: string[],
  requireExactMatch: boolean,
): void {
  const sortedExpectedColumns = [...expectedColumns].sort();
  const missingColumns = sortedExpectedColumns.filter(
    (columnName) => !actualColumns.includes(columnName),
  );
  const unexpectedColumns = requireExactMatch
    ? actualColumns.filter(
        (columnName) => !sortedExpectedColumns.includes(columnName),
      )
    : [];

  if (missingColumns.length > 0 || unexpectedColumns.length > 0) {
    throw new Error(
      `Chore-planning teardown found an unexpected ${tableName} schema. ` +
        `Missing columns: ${missingColumns.join(', ') || 'none'}. ` +
        `Unexpected columns: ${unexpectedColumns.join(', ') || 'none'}.`,
    );
  }
}

async function assertExpectedSchema(
  knex: Knex,
  schemaName: string,
): Promise<void> {
  await Promise.all(
    Object.entries(FEATURE_TABLE_COLUMNS).map(
      async ([tableName, expectedColumns]) => {
        const actualColumns = await getColumns(knex, schemaName, tableName);
        assertColumns(tableName, actualColumns, expectedColumns, true);
      },
    ),
  );

  await Promise.all(
    Object.entries(SHARED_TABLE_COLUMNS).map(
      async ([tableName, expectedColumns]) => {
        const actualColumns = await getColumns(knex, schemaName, tableName);
        assertColumns(tableName, actualColumns, expectedColumns, false);
      },
    ),
  );
}

async function assertNamedConstraint(
  knex: Knex,
  schemaName: string,
  tableName: string,
  constraintName: string,
  constraintType: string,
): Promise<void> {
  const rows = (await knex('information_schema.table_constraints')
    .select(
      'constraint_name as constraintName',
      'constraint_type as constraintType',
    )
    .where({
      constraint_name: constraintName,
      table_name: tableName,
      table_schema: schemaName,
    })) as ConstraintRow[];

  if (
    rows.length !== 1 ||
    rows[0].constraintName !== constraintName ||
    rows[0].constraintType !== constraintType
  ) {
    throw new Error(
      `Chore-planning teardown expected ${constraintType} constraint ` +
        `${constraintName} on ${tableName}.`,
    );
  }
}

async function getChorePlanForeignKey(
  knex: Knex,
  schemaName: string,
): Promise<string> {
  const result = await knex.raw<{ rows: ForeignKeyRow[] }>(
    `
      SELECT
        tc.constraint_name AS "constraintName",
        ccu.table_schema AS "foreignTableSchema",
        ccu.table_name AS "foreignTableName",
        ccu.column_name AS "foreignColumnName"
      FROM information_schema.table_constraints AS tc
      INNER JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_catalog = kcu.constraint_catalog
        AND tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
      INNER JOIN information_schema.constraint_column_usage AS ccu
        ON tc.constraint_catalog = ccu.constraint_catalog
        AND tc.constraint_schema = ccu.constraint_schema
        AND tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ?
        AND tc.table_name = 'schedules'
        AND kcu.column_name = 'chorePlanID'
    `,
    [schemaName],
  );
  const [foreignKey] = result.rows;

  if (
    result.rows.length !== 1 ||
    foreignKey.foreignTableSchema !== schemaName ||
    foreignKey.foreignTableName !== 'chore_plans' ||
    foreignKey.foreignColumnName !== 'id'
  ) {
    throw new Error(
      'Chore-planning teardown expected schedules.chorePlanID to reference ' +
        'chore_plans.id.',
    );
  }

  return foreignKey.constraintName;
}

export async function up(knex: Knex): Promise<void> {
  const schemaName = await getCurrentSchema(knex);

  await assertExpectedSchema(knex, schemaName);
  await assertNamedConstraint(
    knex,
    schemaName,
    'schedules',
    'schedules_chore_plan_key_unique',
    'UNIQUE',
  );
  await assertNamedConstraint(
    knex,
    schemaName,
    'shifts',
    'shifts_planner_key_unique',
    'UNIQUE',
  );
  await assertNamedConstraint(
    knex,
    schemaName,
    'shift_participants',
    'shift_participants_shift_user_unique',
    'UNIQUE',
  );
  const chorePlanForeignKey = await getChorePlanForeignKey(knex, schemaName);

  const choreScheduleRows = (await knex('schedules')
    .select('id')
    .whereNotNull('chorePlanID')) as IDRow[];
  const choreScheduleIDs = choreScheduleRows.map(({ id }) => id);
  const choreShiftRows = (await knex('shifts')
    .select('id')
    .whereIn('scheduleID', choreScheduleIDs)) as IDRow[];
  const choreShiftIDs = choreShiftRows.map(({ id }) => id);
  const choreParticipantRows = (await knex('shift_participants')
    .select('id')
    .whereIn('shiftID', choreShiftIDs)) as IDRow[];

  console.log(
    'Chore-planning teardown will delete ' +
      `${choreScheduleIDs.length} schedules, ` +
      `${choreShiftIDs.length} shifts, and ` +
      `${choreParticipantRows.length} shift participant assignments.`,
  );

  await knex('shift_participants').whereIn('shiftID', choreShiftIDs).delete();
  await knex('shifts').whereIn('scheduleID', choreScheduleIDs).delete();
  await knex('schedules').whereIn('id', choreScheduleIDs).delete();

  await knex.schema.dropTable('chore_plan_requirement_overrides');
  await knex.schema.dropTable('chore_plan_audit_entries');

  await knex.schema.alterTable('shifts', (table) => {
    table.dropUnique(['scheduleID', 'plannerKey'], 'shifts_planner_key_unique');
    table.dropColumn('plannerKey');
  });

  await knex.schema.alterTable('schedules', (table) => {
    table.dropUnique(
      ['chorePlanID', 'plannerKey'],
      'schedules_chore_plan_key_unique',
    );
  });
  await knex.raw('ALTER TABLE ??.?? DROP CONSTRAINT ??', [
    schemaName,
    'schedules',
    chorePlanForeignKey,
  ]);
  await knex.schema.alterTable('schedules', (table) => {
    table.dropColumn('plannerKey');
    table.dropColumn('chorePlanID');
  });

  await knex.schema.dropTable('chore_plans');
}

export function down(_knex: Knex): Promise<void> {
  // Deleted data and removed schema cannot be reconstructed. Any future chore
  // schema must be introduced by a new forward migration.
  return Promise.resolve();
}
