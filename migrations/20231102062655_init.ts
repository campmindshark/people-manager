import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    return knex.schema
        .createTable('users', (table) => {
            table.increments('id').primary();

            table.string('firstName');
            table.string('lastName');
            table.string('email');
            table.string('password');
            table.string('googleID');

        })
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema
    .dropTableIfExists('users')
}

