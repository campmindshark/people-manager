/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';

async function upsertRoster(
  knex: Knex,
  roster: { id: number; year: number },
): Promise<void> {
  const existing = await knex('rosters').where({ id: roster.id }).first();
  if (!existing) {
    await knex('rosters').insert(roster);
  }
}

export async function seed(knex: Knex): Promise<void> {
  const startYear = 2024;
  const currentYear = new Date().getFullYear();
  for (let year = startYear; year <= currentYear; year += 1) {
    const id = year - startYear + 1;
    // eslint-disable-next-line no-await-in-loop
    await upsertRoster(knex, { id, year });
  }
}
