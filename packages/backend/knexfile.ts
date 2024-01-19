import type { Knex } from 'knex';
import { getConfig } from './config/config';

// Update with your config settings.
const appConfig = getConfig();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './dev.sqlite3',
    },
  },

  staging: {
    client: 'postgresql',
    connection: appConfig.PostgresConnectionURL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },

  production: {
    debug: true,
    client: 'postgresql',
    connection: appConfig.PostgresConnectionURL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },
};

export default config;
