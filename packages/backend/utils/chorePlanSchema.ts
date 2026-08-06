import { Knex } from 'knex';

const databasesWithOwnershipColumns = new WeakSet<object>();

export default async function hasChorePlanOwnershipColumns(
  database: Knex,
): Promise<boolean> {
  if (databasesWithOwnershipColumns.has(database)) {
    return true;
  }

  const hasOwnershipColumn = await database.schema.hasColumn(
    'schedules',
    'chorePlanID',
  );
  if (hasOwnershipColumn) {
    databasesWithOwnershipColumns.add(database);
  }
  return hasOwnershipColumn;
}
