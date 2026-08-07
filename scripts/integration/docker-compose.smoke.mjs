import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function run(command) {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

async function waitFor(url, label, options = {}) {
  const { validate, timeoutMs = 180000, intervalMs = 2000 } = options;
  const started = Date.now();
  let attempts = 0;
  console.log(`Waiting for ${label}...`);

  while (Date.now() - started < timeoutMs) {
    attempts += 1;
    try {
      const response = await fetch(url);
      if (response.ok) {
        if (!validate) {
          return;
        }
        const text = await response.text();
        if (validate(text, response)) {
          return;
        }
      }
    } catch (_error) {
      // Service may not be ready yet.
    }
    if (attempts % 5 === 0) {
      console.log(`Still waiting for ${label} (${attempts} attempts)...`);
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runIntegrationTest() {
  console.log('Running docker-compose integration smoke test...');
  run('docker compose down -v --remove-orphans');
  run('docker compose up -d');

  try {
    await waitFor('http://localhost:3001/api/health', 'backend health', {
      validate: (body) => body.includes('healthy'),
    });
    await waitFor('http://localhost:3000', 'frontend web server');

    const devStatusResponse = await fetch(
      'http://localhost:3001/api/auth/dev/status',
    );
    assert(devStatusResponse.ok, 'Dev status endpoint is not reachable');
    const devStatus = await devStatusResponse.json();
    assert(
      devStatus.available === true,
      'Dev auth bypass is not enabled in docker-compose environment',
    );

    const loginResponse = await fetch(
      'http://localhost:3001/api/auth/dev/login/admin',
      { redirect: 'manual' },
    );
    assert(
      loginResponse.status === 302 || loginResponse.status === 303,
      'Expected redirect response from dev login endpoint',
    );
    const cookie = loginResponse.headers.get('set-cookie');
    assert(cookie, 'Dev login did not return a session cookie');

    const sessionCookie = cookie.split(';')[0];

    const authCheckResponse = await fetch(
      'http://localhost:3001/api/auth/login/success',
      {
        headers: { cookie: sessionCookie },
      },
    );
    assert(authCheckResponse.ok, 'Auth check endpoint failed after dev login');
    const authCheck = await authCheckResponse.json();
    assert(authCheck.success === true, 'Dev login did not authenticate user');
    assert(authCheck.user, 'Auth check did not return a user payload');

    const featureFlagsResponse = await fetch(
      'http://localhost:3001/api/settings/features',
      {
        headers: { cookie: sessionCookie },
      },
    );
    assert(featureFlagsResponse.ok, 'Feature flags endpoint failed');
    const featureFlags = await featureFlagsResponse.json();
    assert(
      featureFlags.chorePlanning === false,
      'Chore planning must be disabled in the smoke-test environment',
    );

    const chorePlanningResponse = await fetch(
      'http://localhost:3001/api/chore-plans',
      {
        headers: { cookie: sessionCookie },
      },
    );
    assert(
      chorePlanningResponse.status === 404,
      'Disabled chore-planning routes must appear absent',
    );

    const verificationResponse = await fetch(
      `http://localhost:3001/api/users/verify/${authCheck.user.id}`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(verificationResponse.ok, 'Could not verify the smoke-test user');

    const adminRosterSignupResponse = await fetch(
      'http://localhost:3001/api/roster_participants/1',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          probabilityOfAttending: 100,
          estimatedArrivalDate: '2024-08-20T00:00:00.000Z',
          estimatedDepartureDate: '2024-09-10T00:00:00.000Z',
          sleepingArrangement: 'Smoke-test fixture',
          yearsAtCamp: [],
        }),
      },
    );
    assert(
      adminRosterSignupResponse.ok,
      'Could not create the smoke-test roster participant',
    );

    const groupResponse = await fetch('http://localhost:3001/api/groups', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Smoke-test signup group',
        description: 'Disposable ordinary-shift signup access',
        rosterID: 1,
        shiftSignupOpenDate: '2020-01-01T00:00:00.000Z',
      }),
    });
    assert(groupResponse.ok, 'Could not create a shift signup group');
    const group = await groupResponse.json();

    const groupMemberResponse = await fetch(
      `http://localhost:3001/api/groups/${group.id}/members/${authCheck.user.id}`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(groupMemberResponse.ok, 'Could not add the user to a signup group');

    const signupResponse = await fetch(
      'http://localhost:3001/api/shifts/1/signup',
      { headers: { cookie: sessionCookie } },
    );
    assert(signupResponse.ok, 'Ordinary shift signup failed');
    const signupResult = await signupResponse.json();
    assert(
      signupResult.registeredShiftIDs?.[0] === 1,
      'Ordinary shift signup did not register the selected shift',
    );

    const duplicateSignupResponse = await fetch(
      'http://localhost:3001/api/shifts/1/signup',
      { headers: { cookie: sessionCookie } },
    );
    assert(duplicateSignupResponse.ok, 'Duplicate signup was not idempotent');
    const duplicateSignupResult = await duplicateSignupResponse.json();
    assert(
      duplicateSignupResult.registeredShiftIDs?.length === 0,
      'Duplicate signup created another assignment',
    );

    const unregisterResponse = await fetch(
      'http://localhost:3001/api/shifts/1/unregister',
      { headers: { cookie: sessionCookie } },
    );
    assert(unregisterResponse.ok, 'Ordinary shift removal failed');

    const rosterResponse = await fetch('http://localhost:3001/api/rosters/2', {
      headers: { cookie: sessionCookie },
    });
    assert(rosterResponse.ok, 'Expected roster 2 to exist after seed step');

    console.log('Integration smoke test passed.');
  } finally {
    run('docker compose down -v --remove-orphans');
  }
}

runIntegrationTest().catch((error) => {
  console.error('Integration smoke test failed:', error);
  process.exit(1);
});
