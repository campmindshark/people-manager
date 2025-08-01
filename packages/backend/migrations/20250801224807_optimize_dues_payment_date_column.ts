import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('dues_payments', (table) => {
    // Ensure paymentDate column is properly set as timestamp with timezone
    table.timestamp('paymentDate', { useTz: true }).alter();
  });
}


export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('dues_payments', (table) => {
    // Revert to basic timestamp (though the original was already with timezone)
    table.timestamp('paymentDate', { useTz: true }).alter();
  });
}

