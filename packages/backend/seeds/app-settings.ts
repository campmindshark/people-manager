/* eslint-disable import/prefer-default-export */
import { Knex } from 'knex';

async function upsertSetting(
  knex: Knex,
  setting: { key: string; value: string },
): Promise<void> {
  const existing = await knex('app_settings')
    .where({ key: setting.key })
    .first();
  if (!existing) {
    await knex('app_settings').insert(setting);
  }
}

export async function seed(knex: Knex): Promise<void> {
  await upsertSetting(knex, { key: 'active_roster_id', value: '2' });
}
