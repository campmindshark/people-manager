import type { Knex } from 'knex';
import { getConfig } from './config/config';

// Update with your config settings.
const appConfig = getConfig();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: 'postgres://citizix_user:S3cret@localhost:5432/citizix_db',
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      extension: 'ts',
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
    connection: {
      connectionString: appConfig.PostgresConnectionURL,
      ssl: {
        maxVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
    },
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
