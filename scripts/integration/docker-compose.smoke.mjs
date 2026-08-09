import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function run(command, environment = {}) {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
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
      'http://localhost:3001/api/chore-plans/catalog',
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
          estimatedArrivalDate: '2024-08-24T23:00:00.000Z',
          estimatedDepartureDate: '2024-08-25T00:30:00.000Z',
          sleepingArrangement: 'Smoke-test fixture',
          yearsAtCamp: [],
        }),
      },
    );
    assert(
      adminRosterSignupResponse.ok,
      'Could not create the smoke-test roster participant',
    );
    const adminRosterSignup = await adminRosterSignupResponse.json();
    assert(
      adminRosterSignup.estimatedArrivalDate === '2024-08-24T23:00:00.000Z' &&
        adminRosterSignup.estimatedDepartureDate ===
          '2024-08-25T00:30:00.000Z',
      'Roster attendance timestamps were not preserved as absolute instants',
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

    const rosterCleanupResponse = await fetch(
      `http://localhost:3001/api/roster_participants/1/users/${authCheck.user.id}`,
      {
        method: 'DELETE',
        headers: { cookie: sessionCookie },
      },
    );
    assert(
      rosterCleanupResponse.ok,
      'Could not remove the smoke-test roster participant',
    );

    const rosterResponse = await fetch('http://localhost:3001/api/rosters/2', {
      headers: { cookie: sessionCookie },
    });
    assert(rosterResponse.ok, 'Expected roster 2 to exist after seed step');

    const standardLoginResponse = await fetch(
      'http://localhost:3001/api/auth/dev/login/standard',
      { redirect: 'manual' },
    );
    assert(
      standardLoginResponse.status === 302 ||
        standardLoginResponse.status === 303,
      'Expected redirect response from standard-user dev login',
    );
    const standardCookieHeader =
      standardLoginResponse.headers.get('set-cookie');
    assert(standardCookieHeader, 'Standard-user login did not return a cookie');
    const standardCookie = standardCookieHeader.split(';')[0];
    const standardAuthResponse = await fetch(
      'http://localhost:3001/api/auth/login/success',
      { headers: { cookie: standardCookie } },
    );
    assert(standardAuthResponse.ok, 'Standard-user auth check failed');
    const standardAuth = await standardAuthResponse.json();
    assert(standardAuth.user, 'Standard-user auth check omitted the user');

    const verifyStandardResponse = await fetch(
      `http://localhost:3001/api/users/verify/${standardAuth.user.id}`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(verifyStandardResponse.ok, 'Could not verify the standard user');

    run('docker compose up -d --force-recreate --no-deps backend', {
      CHORE_PLANNING_ENABLED: 'true',
    });
    await waitFor(
      'http://localhost:3001/api/health',
      'enabled backend health',
      {
        validate: (body) => body.includes('healthy'),
      },
    );

    const enabledFeatureFlagsResponse = await fetch(
      'http://localhost:3001/api/settings/features',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      enabledFeatureFlagsResponse.ok,
      'Enabled feature flags request failed',
    );
    const enabledFeatureFlags = await enabledFeatureFlagsResponse.json();
    assert(
      enabledFeatureFlags.chorePlanning === true,
      'Chore planning did not enable after backend restart',
    );

    const forbiddenCatalogResponse = await fetch(
      'http://localhost:3001/api/chore-plans/catalog',
      { headers: { cookie: standardCookie } },
    );
    assert(
      forbiddenCatalogResponse.status === 403,
      'A verified standard user must not read the chore catalog',
    );

    const forbiddenPreviewResponse = await fetch(
      'http://localhost:3001/api/chore-plans/preview',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          rosterID: 1,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
        }),
      },
    );
    assert(
      forbiddenPreviewResponse.status === 403,
      'A verified standard user must not preview chore plans',
    );

    const catalogResponse = await fetch(
      'http://localhost:3001/api/chore-plans/catalog',
      { headers: { cookie: sessionCookie } },
    );
    const catalogBody = await catalogResponse.text();
    assert(
      catalogResponse.ok,
      `Admin could not load the chore catalog (${catalogResponse.status}): ${catalogBody}`,
    );
    const catalog = JSON.parse(catalogBody);
    assert(catalog.revision === '1', 'Fresh catalog revision must be 1');
    assert(
      catalog.definitions?.length === 326,
      'Catalog must contain all 326 source definitions',
    );
    const firstDefinition = catalog.definitions[0];

    const updateResponse = await fetch(
      `http://localhost:3001/api/chore-plans/catalog/${firstDefinition.stableKey}/score`,
      {
        method: 'PUT',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ score: 42.25, expectedRevision: '1' }),
      },
    );
    assert(updateResponse.ok, 'Admin could not update a chore score');
    const update = await updateResponse.json();
    assert(update.revision === '2', 'A score change must advance the revision');
    assert(
      update.definition.score === 42.25,
      'The changed score was not returned',
    );

    const immutableFieldResponse = await fetch(
      `http://localhost:3001/api/chore-plans/catalog/${firstDefinition.stableKey}/score`,
      {
        method: 'PUT',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          score: 42.25,
          expectedRevision: '2',
          shiftLabel: 'Changed',
        }),
      },
    );
    assert(
      immutableFieldResponse.status === 400,
      'Catalog definition fields must be rejected by the score endpoint',
    );

    const staleUpdateResponse = await fetch(
      `http://localhost:3001/api/chore-plans/catalog/${catalog.definitions[1].stableKey}/score`,
      {
        method: 'PUT',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ score: 41, expectedRevision: '1' }),
      },
    );
    assert(
      staleUpdateResponse.status === 409,
      'A stale catalog revision must be rejected',
    );

    const previewResponse = await fetch(
      'http://localhost:3001/api/chore-plans/preview',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          rosterID: 1,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
        }),
      },
    );
    assert(previewResponse.ok, 'Admin could not preview a chore plan');
    const preview = await previewResponse.json();
    assert(
      preview.catalogRevision === '2',
      'Preview did not report its consistent catalog revision',
    );
    assert(
      preview.categories?.chore?.selected === 1 &&
        preview.categories?.event?.selected === 1 &&
        preview.categories?.dinner?.selected === 1,
      'Preview did not allocate the requested category capacity',
    );
    assert(
      preview.shifts?.every((shift) =>
        shift.slots?.every((slot) => slot.definitionKey),
      ),
      'Preview slots did not retain stable definition identity',
    );

    const ordinarySchedulesBeforeResponse = await fetch(
      'http://localhost:3001/api/schedules',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      ordinarySchedulesBeforeResponse.ok,
      'Could not read ordinary schedules before applying a draft',
    );
    const ordinarySchedulesBefore =
      await ordinarySchedulesBeforeResponse.json();
    const ordinaryShiftsBeforeResponse = await fetch(
      'http://localhost:3001/api/shifts',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      ordinaryShiftsBeforeResponse.ok,
      'Could not read ordinary shifts before applying a draft',
    );
    const ordinaryShiftsBefore = await ordinaryShiftsBeforeResponse.json();
    assert(
      ordinarySchedulesBefore.every(
        (schedule) =>
          !Object.hasOwn(schedule, 'chorePlanID') &&
          !Object.hasOwn(schedule, 'plannerKey'),
      ),
      'Ordinary schedules exposed internal ownership fields',
    );
    assert(
      ordinaryShiftsBefore.every(
        (shift) => !Object.hasOwn(shift, 'plannerKey'),
      ),
      'Ordinary shifts exposed internal ownership fields',
    );

    const ordinaryScheduleShiftsResponse = await fetch(
      'http://localhost:3001/api/schedules/1/shifts',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      ordinaryScheduleShiftsResponse.ok,
      'Could not read ordinary schedule shift view models',
    );
    const ordinaryScheduleShifts = await ordinaryScheduleShiftsResponse.json();
    assert(
      ordinaryScheduleShifts.every(
        ({ shift }) => !Object.hasOwn(shift, 'plannerKey'),
      ),
      'Ordinary shift view models exposed internal ownership fields',
    );

    const forbiddenApplyResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          rosterID: 1,
          camperCount: 1,
          requirements: { chore: 1, event: 1, dinner: 1 },
          expectedCatalogRevision: '2',
          expectedDraftRevision: null,
        }),
      },
    );
    assert(
      forbiddenApplyResponse.status === 403,
      'A verified standard user must not apply chore plan drafts',
    );

    const firstApplyBody = {
      rosterID: 1,
      camperCount: 1,
      requirements: { chore: 1, event: 1, dinner: 1 },
      expectedCatalogRevision: '2',
      expectedDraftRevision: null,
    };
    const applyResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify(firstApplyBody),
      },
    );
    const applyBody = await applyResponse.text();
    assert(
      applyResponse.ok,
      `Admin could not apply a chore plan draft (${applyResponse.status}): ${applyBody}`,
    );
    const applied = JSON.parse(applyBody);
    assert(
      applied.changed === true &&
        applied.replaced === false &&
        applied.draft?.draftRevision === '1' &&
        applied.draft?.catalogRevision === '2',
      'First draft apply did not return the expected revision state',
    );

    const repeatedApplyResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify(firstApplyBody),
      },
    );
    assert(repeatedApplyResponse.ok, 'Identical draft retry failed');
    const repeatedApply = await repeatedApplyResponse.json();
    assert(
      repeatedApply.changed === false &&
        repeatedApply.draft?.draftRevision === '1',
      'Identical draft retry was not a no-op',
    );

    const mismatchedDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...firstApplyBody,
          camperCount: 2,
        }),
      },
    );
    assert(
      mismatchedDraftResponse.status === 409,
      'Replacing an unobserved draft revision must be rejected',
    );

    const replacementResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...firstApplyBody,
          camperCount: 2,
          expectedDraftRevision: '1',
        }),
      },
    );
    assert(replacementResponse.ok, 'Observed draft replacement failed');
    const replacement = await replacementResponse.json();
    assert(
      replacement.changed === true &&
        replacement.replaced === true &&
        replacement.draft?.draftRevision === '2',
      'Draft replacement did not advance its revision',
    );

    const staleApplyResponse = await fetch(
      'http://localhost:3001/api/chore-plans/apply',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...firstApplyBody,
          camperCount: 2,
          expectedCatalogRevision: '1',
          expectedDraftRevision: '2',
        }),
      },
    );
    assert(
      staleApplyResponse.status === 409,
      'Applying a stale preview revision must be rejected',
    );

    const ordinarySchedulesAfterResponse = await fetch(
      'http://localhost:3001/api/schedules',
      { headers: { cookie: sessionCookie } },
    );
    const ordinaryShiftsAfterResponse = await fetch(
      'http://localhost:3001/api/shifts',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      ordinarySchedulesAfterResponse.ok && ordinaryShiftsAfterResponse.ok,
      'Ordinary schedule APIs failed after applying a draft',
    );
    const ordinarySchedulesAfter = await ordinarySchedulesAfterResponse.json();
    const ordinaryShiftsAfter = await ordinaryShiftsAfterResponse.json();
    assert(
      JSON.stringify(ordinarySchedulesAfter) ===
        JSON.stringify(ordinarySchedulesBefore),
      'Generated draft schedules leaked into the ordinary schedule API',
    );
    assert(
      JSON.stringify(ordinaryShiftsAfter) ===
        JSON.stringify(ordinaryShiftsBefore),
      'Generated draft shifts leaked into the ordinary shift API',
    );

    console.log('Integration smoke test passed.');
  } catch (error) {
    run('docker compose logs --no-color backend migrate');
    throw error;
  } finally {
    run('docker compose down -v --remove-orphans');
  }
}

runIntegrationTest().catch((error) => {
  console.error('Integration smoke test failed:', error);
  process.exit(1);
});
