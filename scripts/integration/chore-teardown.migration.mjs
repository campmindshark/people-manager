import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const databaseName = 'people_manager_chore_teardown_test';
const databasePassword = 'chore-teardown-test-password';
const databaseUser = 'chore_teardown_test';
const containerName = `people-manager-chore-teardown-${randomUUID()}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${result.status}.`,
    );
  }

  return result.stdout?.trim() ?? '';
}

async function waitForPostgres() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60_000) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        containerName,
        'pg_isready',
        '-U',
        databaseUser,
        '-d',
        databaseName,
      ],
      { stdio: 'ignore' },
    );

    if (result.status === 0) {
      return;
    }

    await sleep(500);
  }

  throw new Error('Timed out waiting for the disposable PostgreSQL server.');
}

async function main() {
  console.log('Starting a disposable PostgreSQL migration test container...');
  let containerStarted = false;

  try {
    run(
      'docker',
      [
        'run',
        '--detach',
        '--rm',
        '--name',
        containerName,
        '--env',
        `POSTGRES_DB=${databaseName}`,
        '--env',
        `POSTGRES_PASSWORD=${databasePassword}`,
        '--env',
        `POSTGRES_USER=${databaseUser}`,
        '--publish',
        '127.0.0.1::5432',
        'postgres:14-alpine',
      ],
      { stdio: 'ignore' },
    );
    containerStarted = true;

    await waitForPostgres();
    const portOutput = run('docker', ['port', containerName, '5432/tcp']);
    const portMatch = portOutput.match(/:(\d+)$/);

    if (!portMatch) {
      throw new Error(`Could not parse PostgreSQL port from ${portOutput}.`);
    }

    const requestedTestFiles = process.argv.slice(2);
    const testFiles = (
      requestedTestFiles.length > 0
        ? requestedTestFiles
        : readdirSync('packages/backend/tests').filter((fileName) =>
            fileName.endsWith('.test.ts'),
          )
    ).map((fileName) => path.join('packages/backend/tests', fileName));
    const testResult = spawnSync(
      process.execPath,
      [
        '--require',
        'ts-node/register',
        '--test',
        ...testFiles,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CHORE_TEARDOWN_TEST_DATABASE_URL:
            `postgresql://${databaseUser}:${databasePassword}` +
            `@127.0.0.1:${portMatch[1]}/${databaseName}`,
          TS_NODE_PROJECT: path.resolve('packages/backend/tsconfig.json'),
        },
        stdio: 'inherit',
      },
    );

    if (testResult.status !== 0) {
      throw new Error(
        `Migration integration test failed with status ${testResult.status}.`,
      );
    }
  } finally {
    if (containerStarted) {
      spawnSync('docker', ['stop', containerName], { stdio: 'ignore' });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
