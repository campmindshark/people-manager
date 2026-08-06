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
    const disabledLifecycleResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/open',
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(
      disabledLifecycleResponse.status === 404,
      'Disabled chore lifecycle routes must appear absent',
    );
    const disabledShiftViewResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      disabledShiftViewResponse.status === 404,
      'Disabled chore shift-view routes must appear absent',
    );

    const verificationResponse = await fetch(
      `http://localhost:3001/api/users/verify/${authCheck.user.id}`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(verificationResponse.ok, 'Could not verify the smoke-test user');

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

    const rosterSignupResponse = await fetch(
      'http://localhost:3001/api/roster_participants/1',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          probabilityOfAttending: 100,
          yearsAtCamp: [],
          estimatedArrivalDate: '2026-08-20T00:00:00.000Z',
          estimatedDepartureDate: '2026-09-10T00:00:00.000Z',
          sleepingArrangement: 'Smoke test',
        }),
      },
    );
    assert(rosterSignupResponse.ok, 'Could not add the standard roster member');

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

    const forbiddenOutsiderShiftViewResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      forbiddenOutsiderShiftViewResponse.status === 403,
      'A verified non-member must not read chore plan shifts',
    );
    const emptyShiftViewResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: standardCookie } },
    );
    assert(emptyShiftViewResponse.ok, 'Roster member could not read empty plan');
    const emptyShiftView = await emptyShiftViewResponse.json();
    assert(
      emptyShiftView.plan === null &&
        emptyShiftView.selfServiceMutationsAllowed === false &&
        emptyShiftView.shifts?.length === 0,
      'Empty member shift view returned unexpected state',
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

    const forbiddenDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/draft/1',
      { headers: { cookie: standardCookie } },
    );
    assert(
      forbiddenDraftResponse.status === 403,
      'A verified standard user must not read chore plan drafts',
    );
    const emptyDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/draft/1',
      { headers: { cookie: sessionCookie } },
    );
    assert(emptyDraftResponse.ok, 'Admin could not read current draft state');
    const emptyDraft = await emptyDraftResponse.json();
    assert(emptyDraft.draft === null, 'Roster unexpectedly had a draft');

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
    const savedDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/draft/1',
      { headers: { cookie: sessionCookie } },
    );
    assert(savedDraftResponse.ok, 'Admin could not reload the saved draft');
    const savedDraft = await savedDraftResponse.json();
    assert(
      savedDraft.draft?.draftRevision === '1' &&
        savedDraft.draft?.catalogRevision === '2',
      'Saved draft read model did not match the applied draft',
    );
    const memberDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: standardCookie } },
    );
    assert(memberDraftResponse.ok, 'Roster member could not read draft state');
    const memberDraft = await memberDraftResponse.json();
    assert(
      memberDraft.plan?.status === 'draft' &&
        memberDraft.selfServiceMutationsAllowed === false &&
        memberDraft.shifts?.length === 0,
      'Draft generated shifts were exposed to a roster member',
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

    const forbiddenOpenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/open',
      {
        method: 'POST',
        headers: { cookie: standardCookie },
      },
    );
    assert(
      forbiddenOpenResponse.status === 403,
      'A verified standard user must not open chore plans',
    );
    const openResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/open',
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(openResponse.ok, 'Admin could not open the draft chore plan');
    const openedPlan = await openResponse.json();
    assert(
      openedPlan.status === 'open' &&
        openedPlan.openedByUserID === authCheck.user.id &&
        openedPlan.openedAt &&
        openedPlan.closedAt === null,
      'Opening did not return the expected lifecycle state',
    );
    const memberOpenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: standardCookie } },
    );
    assert(memberOpenResponse.ok, 'Roster member could not read open plan');
    const memberOpen = await memberOpenResponse.json();
    assert(
      memberOpen.plan?.status === 'open' &&
        memberOpen.selfServiceMutationsAllowed === true &&
        memberOpen.shifts?.length > 0 &&
        ['chore', 'event', 'dinner'].every((kind) =>
          memberOpen.shifts.some((shift) => shift.kind === kind),
        ),
      'Open member shift view omitted generated category rows',
    );
    assert(
      !JSON.stringify(memberOpen).includes('userID') &&
        !JSON.stringify(memberOpen).includes('@localhost'),
      'Member shift view exposed participant identity fields',
    );

    const repeatedOpenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/open',
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(
      repeatedOpenResponse.status === 409,
      'Opening an already-open chore plan must be rejected',
    );
    const closeResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/close',
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(closeResponse.ok, 'Admin could not close the open chore plan');
    const closedPlan = await closeResponse.json();
    assert(
      closedPlan.status === 'closed' &&
        closedPlan.closedByUserID === authCheck.user.id &&
        closedPlan.closedAt,
      'Closing did not return the expected lifecycle state',
    );
    const memberClosedResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: standardCookie } },
    );
    assert(memberClosedResponse.ok, 'Roster member could not read closed plan');
    const memberClosed = await memberClosedResponse.json();
    assert(
      memberClosed.plan?.status === 'closed' &&
        memberClosed.selfServiceMutationsAllowed === false &&
        memberClosed.shifts?.length === memberOpen.shifts.length,
      'Closed member shift view did not remain visible and read-only',
    );

    const invalidReopenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/reopen',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: '   ' }),
      },
    );
    assert(
      invalidReopenResponse.status === 400,
      'Reopening without a reason must be rejected',
    );
    const forbiddenReopenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/reopen',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Standard user attempt' }),
      },
    );
    assert(
      forbiddenReopenResponse.status === 403,
      'A verified standard user must not reopen chore plans',
    );
    const reopenResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/reopen',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: '  Smoke-test correction  ' }),
      },
    );
    assert(reopenResponse.ok, 'Admin could not reopen the closed chore plan');
    const reopenedPlan = await reopenResponse.json();
    assert(
      reopenedPlan.status === 'open' &&
        reopenedPlan.openedByUserID === authCheck.user.id &&
        reopenedPlan.closedAt === null &&
        reopenedPlan.closedByUserID === null,
      'Reopening did not return the expected lifecycle state',
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
