import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function run(command, environment = {}) {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
  });
}

function output(command, environment = {}) {
  return execSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

function operationalEvents(logs) {
  return logs
    .split('\n')
    .flatMap((line) => {
      const jsonStart = line.indexOf('{"timestamp"');
      return jsonStart < 0 ? [] : [JSON.parse(line.slice(jsonStart))];
    })
    .filter(({ event }) => event?.startsWith('chore_plan.'));
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
    const disabledChoreSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [1] }),
      },
    );
    assert(
      disabledChoreSignupResponse.status === 404,
      'Disabled chore signup routes must appear absent',
    );
    const disabledAdminAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      disabledAdminAssignmentsResponse.status === 404,
      'Disabled administrative assignment routes must appear absent',
    );
    const disabledRequirementOverridesResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/requirements',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      disabledRequirementOverridesResponse.status === 404,
      'Disabled requirement-override routes must appear absent',
    );
    const disabledReadinessResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/readiness',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      disabledReadinessResponse.status === 404,
      'Disabled readiness routes must appear absent',
    );
    const disabledFinalAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/final-assignments',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      disabledFinalAssignmentsResponse.status === 404,
      'Disabled final-assignment routes must appear absent',
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
          estimatedArrivalDate: '2024-08-20T00:00:00.000Z',
          estimatedDepartureDate: '2024-09-10T00:00:00.000Z',
          sleepingArrangement: 'Smoke test',
        }),
      },
    );
    assert(rosterSignupResponse.ok, 'Could not add the standard roster member');

    const standardGroupMemberResponse = await fetch(
      `http://localhost:3001/api/groups/${group.id}/members/${standardAuth.user.id}`,
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    assert(
      standardGroupMemberResponse.ok,
      'Could not add the roster member to a signup group',
    );

    const signupResponse = await fetch(
      'http://localhost:3001/api/shifts/1/signup',
      { headers: { cookie: standardCookie } },
    );
    assert(signupResponse.ok, 'Ordinary shift signup failed');
    const signupResult = await signupResponse.json();
    assert(
      signupResult.registeredShiftIDs?.[0] === 1,
      'Ordinary shift signup did not register the selected shift',
    );

    const duplicateSignupResponse = await fetch(
      'http://localhost:3001/api/shifts/1/signup',
      { headers: { cookie: standardCookie } },
    );
    assert(duplicateSignupResponse.ok, 'Duplicate signup was not idempotent');
    const duplicateSignupResult = await duplicateSignupResponse.json();
    assert(
      duplicateSignupResult.registeredShiftIDs?.length === 0,
      'Duplicate signup created another assignment',
    );

    const unregisterResponse = await fetch(
      'http://localhost:3001/api/shifts/1/unregister',
      { headers: { cookie: standardCookie } },
    );
    assert(unregisterResponse.ok, 'Ordinary shift removal failed');

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
    const assignmentAdminRosterSignupResponse = await fetch(
      'http://localhost:3001/api/roster_participants/1',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          probabilityOfAttending: 100,
          yearsAtCamp: [],
          estimatedArrivalDate: '2024-08-20T00:00:00.000Z',
          estimatedDepartureDate: '2024-09-10T00:00:00.000Z',
          sleepingArrangement: 'Administrative assignment smoke test',
        }),
      },
    );
    assert(
      assignmentAdminRosterSignupResponse.ok,
      'Could not add the admin as an assignment-test roster member',
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
    const draftFinalAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/final-assignments',
      { headers: { cookie: standardCookie } },
    );
    assert(
      draftFinalAssignmentsResponse.status === 409,
      'Draft plans must not expose final assignments',
    );
    const forbiddenReadinessResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/readiness',
      { headers: { cookie: standardCookie } },
    );
    assert(
      forbiddenReadinessResponse.status === 403,
      'A standard user must not read chore plan readiness',
    );
    const adminDraftReadinessResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/readiness',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      adminDraftReadinessResponse.ok,
      'Admin could not read draft chore plan readiness',
    );
    const adminDraftReadiness = await adminDraftReadinessResponse.json();
    assert(
      adminDraftReadiness.status === 'draft' &&
        adminDraftReadiness.plannerHeadcount === 1 &&
        adminDraftReadiness.actualRosterCount === 2 &&
        adminDraftReadiness.categories?.chore?.requiredShifts === 2 &&
        adminDraftReadiness.categories?.chore?.assignedShifts === 0 &&
        adminDraftReadiness.incompleteParticipants?.length === 2,
      'Draft readiness omitted headcount or unique assignment totals',
    );
    const forbiddenAdminAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: standardCookie } },
    );
    assert(
      forbiddenAdminAssignmentsResponse.status === 403,
      'A standard user must not read administrative assignments',
    );
    const adminDraftAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      adminDraftAssignmentsResponse.ok,
      'Admin could not read draft administrative assignment state',
    );
    const adminDraftAssignments = await adminDraftAssignmentsResponse.json();
    assert(
      adminDraftAssignments.plan?.status === 'draft' &&
        adminDraftAssignments.mutationsAllowed === false &&
        adminDraftAssignments.participants?.length === 2,
      'Draft administrative assignment state was incomplete',
    );
    const forbiddenRequirementsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/requirements',
      { headers: { cookie: standardCookie } },
    );
    assert(
      forbiddenRequirementsResponse.status === 403,
      'A standard user must not read participant requirement overrides',
    );
    const adminRequirementsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/requirements',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      adminRequirementsResponse.ok,
      'Admin could not read participant requirements',
    );
    const adminRequirements = await adminRequirementsResponse.json();
    assert(
      adminRequirements.plan?.status === 'draft' &&
        adminRequirements.mutationsAllowed === true &&
        adminRequirements.participants?.length === 2 &&
        adminRequirements.participants.every(
          (participant) => participant.hasOverride === false,
        ),
      'Initial participant requirement state was incomplete',
    );
    const forbiddenRequirementMutationResponse = await fetch(
      `http://localhost:3001/api/chore-plans/admin/1/participants/${standardAuth.user.id}/requirements`,
      {
        method: 'PUT',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requirements: { chore: 0, event: 1, dinner: 1 },
          reason: 'Standard user attempt',
        }),
      },
    );
    assert(
      forbiddenRequirementMutationResponse.status === 403,
      'A standard user must not change participant requirements',
    );
    const strictRequirementMutationResponse = await fetch(
      `http://localhost:3001/api/chore-plans/admin/1/participants/${standardAuth.user.id}/requirements`,
      {
        method: 'PUT',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requirements: { chore: 0, event: 1, dinner: 1 },
          reason: 'Smoke-test accommodation',
          force: true,
        }),
      },
    );
    assert(
      strictRequirementMutationResponse.status === 400,
      'Requirement overrides must reject unexpected fields',
    );
    const requirementMutationResponse = await fetch(
      `http://localhost:3001/api/chore-plans/admin/1/participants/${standardAuth.user.id}/requirements`,
      {
        method: 'PUT',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          requirements: { chore: 0, event: 1, dinner: 1 },
          reason: '  Smoke-test accommodation  ',
        }),
      },
    );
    assert(requirementMutationResponse.ok, 'Requirement override failed');
    const requirementMutation = await requirementMutationResponse.json();
    assert(
      requirementMutation.changed === true &&
        requirementMutation.participant?.hasOverride === true &&
        requirementMutation.participant?.requirements?.chore === 0 &&
        requirementMutation.participant?.overrideReason ===
          'Smoke-test accommodation',
      'Requirement override did not return its effective state',
    );
    const overriddenMemberDraftResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/shifts',
      { headers: { cookie: standardCookie } },
    );
    const overriddenMemberDraft = await overriddenMemberDraftResponse.json();
    assert(
      overriddenMemberDraft.plan?.requirements?.chore === 0,
      'Member shift state did not use effective requirements',
    );
    const overriddenAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: sessionCookie } },
    );
    const overriddenAssignments = await overriddenAssignmentsResponse.json();
    assert(
      overriddenAssignments.participants?.find(
        (participant) => participant.userID === standardAuth.user.id,
      )?.requirements?.chore === 0,
      'Administrative assignment state did not use effective requirements',
    );
    const overriddenReadinessResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/readiness',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      overriddenReadinessResponse.ok,
      'Admin could not refresh readiness after a requirement override',
    );
    const overriddenReadiness = await overriddenReadinessResponse.json();
    assert(
      overriddenReadiness.requirementExceptions?.some(
        (exception) =>
          exception.userID === standardAuth.user.id &&
          exception.requirements?.chore === 0 &&
          exception.reason === 'Smoke-test accommodation',
      ),
      'Readiness did not use the shared effective requirement override',
    );
    const missingClearReasonResponse = await fetch(
      `http://localhost:3001/api/chore-plans/admin/1/participants/${standardAuth.user.id}/requirements`,
      {
        method: 'DELETE',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
    assert(
      missingClearReasonResponse.status === 400,
      'Clearing a requirement override must require a reason',
    );
    const clearRequirementResponse = await fetch(
      `http://localhost:3001/api/chore-plans/admin/1/participants/${standardAuth.user.id}/requirements`,
      {
        method: 'DELETE',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Smoke-test reset' }),
      },
    );
    assert(clearRequirementResponse.ok, 'Requirement reset failed');
    const clearedRequirement = await clearRequirementResponse.json();
    assert(
      clearedRequirement.changed === true &&
        clearedRequirement.participant?.hasOverride === false &&
        clearedRequirement.participant?.requirements?.chore === 1,
      'Requirement reset did not restore plan defaults',
    );
    const draftSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [1] }),
      },
    );
    assert(
      draftSignupResponse.status === 409,
      'Draft chore signup must not succeed',
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
    const openSignupStatusResponse = await fetch(
      'http://localhost:3001/api/users/signup-status/1',
      { headers: { cookie: standardCookie } },
    );
    assert(
      openSignupStatusResponse.ok,
      'Roster member could not read open chore signup status',
    );
    const openSignupStatus = await openSignupStatusResponse.json();
    assert(
      openSignupStatus.chorePlanStatus === 'open' &&
        openSignupStatus.choreSignupsOpen === true &&
        openSignupStatus.requirements?.chore === 1 &&
        openSignupStatus.requirements?.event === 1 &&
        openSignupStatus.requirements?.dinner === 1 &&
        openSignupStatus.shiftCount === 0,
      'Participant signup status omitted open-plan requirements or counts',
    );
    const signupSource = memberOpen.shifts[0];
    const signupDestination = memberOpen.shifts.find(
      (shift) =>
        shift.id !== signupSource.id && shift.kind === signupSource.kind,
    );
    assert(signupDestination, 'Open plan did not contain a switch destination');
    const strictSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [signupSource.id], force: true }),
      },
    );
    assert(
      strictSignupResponse.status === 400,
      'Chore signup must reject fields outside the narrow request contract',
    );
    const choreSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [signupSource.id] }),
      },
    );
    assert(choreSignupResponse.ok, 'Open chore signup failed');
    const choreSignup = await choreSignupResponse.json();
    assert(
      choreSignup.changed === true &&
        choreSignup.assignedShiftIDs?.includes(signupSource.id),
      'Open chore signup did not create the requested assignment',
    );
    const assignedSignupStatusResponse = await fetch(
      'http://localhost:3001/api/users/signup-status/1',
      { headers: { cookie: standardCookie } },
    );
    const assignedSignupStatus = await assignedSignupStatusResponse.json();
    assert(
      assignedSignupStatusResponse.ok &&
        assignedSignupStatus.shiftCount === 1 &&
        assignedSignupStatus[`${signupSource.kind}ShiftCount`] === 1,
      'Participant signup status did not count the distinct generated shift',
    );
    const repeatedChoreSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [signupSource.id] }),
      },
    );
    assert(
      repeatedChoreSignupResponse.ok &&
        (await repeatedChoreSignupResponse.json()).changed === false,
      'Repeated chore signup was not an idempotent no-op',
    );
    const choreSwitchResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/switch',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fromShiftID: signupSource.id,
          toShiftID: signupDestination.id,
        }),
      },
    );
    assert(choreSwitchResponse.ok, 'Atomic chore shift switch failed');
    const choreSwitch = await choreSwitchResponse.json();
    assert(
      choreSwitch.changed === true &&
        !choreSwitch.assignedShiftIDs?.includes(signupSource.id) &&
        choreSwitch.assignedShiftIDs?.includes(signupDestination.id),
      'Chore shift switch did not replace the source assignment',
    );
    const strictRemovalResponse = await fetch(
      `http://localhost:3001/api/chore-plans/1/signup/${signupDestination.id}`,
      {
        method: 'DELETE',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      },
    );
    assert(
      strictRemovalResponse.status === 400,
      'Chore signup removal must reject request details',
    );
    const choreRemovalResponse = await fetch(
      `http://localhost:3001/api/chore-plans/1/signup/${signupDestination.id}`,
      {
        method: 'DELETE',
        headers: { cookie: standardCookie },
      },
    );
    assert(choreRemovalResponse.ok, 'Chore signup removal failed');
    const choreRemoval = await choreRemovalResponse.json();
    assert(
      choreRemoval.changed === true &&
        !choreRemoval.assignedShiftIDs?.includes(signupDestination.id),
      'Chore signup removal did not delete the assignment',
    );

    const adminOpenAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: sessionCookie } },
    );
    assert(
      adminOpenAssignmentsResponse.ok,
      'Admin could not read open assignment state',
    );
    const adminOpenAssignments = await adminOpenAssignmentsResponse.json();
    assert(
      adminOpenAssignments.plan?.status === 'open' &&
        adminOpenAssignments.mutationsAllowed === true &&
        adminOpenAssignments.participants?.some(
          (participant) => participant.userID === standardAuth.user.id,
        ) &&
        adminOpenAssignments.participants?.some(
          (participant) => participant.userID === authCheck.user.id,
        ),
      'Open administrative assignment view omitted plan or participant state',
    );
    const adminSource = adminOpenAssignments.shifts.find(
      (shift) => shift.id === signupSource.id,
    );
    const adminDestination = adminOpenAssignments.shifts.find(
      (shift) => shift.id === signupDestination.id,
    );
    assert(
      adminSource && adminDestination,
      'Administrative assignment view omitted mutation shifts',
    );
    const forbiddenAdminMutationResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'assign',
          userID: standardAuth.user.id,
          shiftID: adminSource.id,
        }),
      },
    );
    assert(
      forbiddenAdminMutationResponse.status === 403,
      'A standard user must not mutate administrative assignments',
    );
    const strictAdminMutationResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'assign',
          userID: standardAuth.user.id,
          shiftID: adminSource.id,
          force: true,
        }),
      },
    );
    assert(
      strictAdminMutationResponse.status === 400,
      'Ordinary administrative mutations must reject force fields',
    );

    const mutateAdminAssignments = async (mutation) => {
      const response = await fetch(
        'http://localhost:3001/api/chore-plans/admin/1/assignments',
        {
          method: 'POST',
          headers: {
            cookie: sessionCookie,
            'content-type': 'application/json',
          },
          body: JSON.stringify(mutation),
        },
      );
      return response;
    };
    const standardAdminAssignResponse = await mutateAdminAssignments({
      operation: 'assign',
      userID: standardAuth.user.id,
      shiftID: adminSource.id,
    });
    assert(standardAdminAssignResponse.ok, 'Admin assign operation failed');
    const actorAdminAssignResponse = await mutateAdminAssignments({
      operation: 'assign',
      userID: authCheck.user.id,
      shiftID: adminDestination.id,
    });
    assert(actorAdminAssignResponse.ok, 'Second admin assign operation failed');

    const blockedMove = {
      operation: 'move',
      userID: standardAuth.user.id,
      fromShiftID: adminSource.id,
      toShiftID: adminDestination.id,
    };
    const blockedMoveResponse = await mutateAdminAssignments(blockedMove);
    assert(
      blockedMoveResponse.status === 409,
      'A move into a full shift must be rejected',
    );
    const afterBlockedMoveResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/assignments',
      { headers: { cookie: sessionCookie } },
    );
    const afterBlockedMove = await afterBlockedMoveResponse.json();
    assert(
      afterBlockedMove.shifts
        .find((shift) => shift.id === adminSource.id)
        ?.assignedUserIDs.includes(standardAuth.user.id),
      'A failed administrative move removed its source assignment',
    );
    const forceMoveResponse = await fetch(
      'http://localhost:3001/api/chore-plans/admin/1/force-assignments',
      {
        method: 'POST',
        headers: {
          cookie: sessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          mutation: blockedMove,
          reason: 'Smoke-test capacity exception',
        }),
      },
    );
    assert(forceMoveResponse.ok, 'Forced administrative move failed');
    const forceMove = await forceMoveResponse.json();
    assert(
      forceMove.forced === true &&
        forceMove.bypassedRules?.includes(
          `capacity:shift:${adminDestination.id}`,
        ),
      'Forced move did not report its capacity bypass',
    );
    const unassignAfterForceResponse = await mutateAdminAssignments({
      operation: 'unassign',
      userID: standardAuth.user.id,
      shiftID: adminDestination.id,
    });
    assert(unassignAfterForceResponse.ok, 'Admin unassign operation failed');
    const reassignForSwapResponse = await mutateAdminAssignments({
      operation: 'assign',
      userID: standardAuth.user.id,
      shiftID: adminSource.id,
    });
    assert(reassignForSwapResponse.ok, 'Could not prepare the admin swap');
    const swapResponse = await mutateAdminAssignments({
      operation: 'swap',
      firstUserID: standardAuth.user.id,
      firstShiftID: adminSource.id,
      secondUserID: authCheck.user.id,
      secondShiftID: adminDestination.id,
    });
    assert(swapResponse.ok, 'Administrative swap failed');
    const cleanupFirstResponse = await mutateAdminAssignments({
      operation: 'unassign',
      userID: authCheck.user.id,
      shiftID: adminSource.id,
    });
    const cleanupSecondResponse = await mutateAdminAssignments({
      operation: 'unassign',
      userID: standardAuth.user.id,
      shiftID: adminDestination.id,
    });
    assert(
      cleanupFirstResponse.ok && cleanupSecondResponse.ok,
      'Could not clean up administrative assignment smoke rows',
    );
    const finalAssignmentSetupResponse = await mutateAdminAssignments({
      operation: 'assign',
      userID: standardAuth.user.id,
      shiftID: adminSource.id,
    });
    assert(
      finalAssignmentSetupResponse.ok,
      'Could not prepare the final-assignment smoke row',
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
    const finalAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/final-assignments',
      { headers: { cookie: standardCookie } },
    );
    assert(
      finalAssignmentsResponse.ok,
      'Roster member could not read final assignments',
    );
    const finalAssignments = await finalAssignmentsResponse.json();
    const serializedFinalAssignments = JSON.stringify(finalAssignments);
    const finalAssignedShift = finalAssignments.categories
      ?.flatMap((category) => category.shifts)
      .find((shift) => shift.id === adminSource.id);
    assert(
      finalAssignments.status === 'closed' &&
        finalAssignments.assignmentCount === 1 &&
        finalAssignments.categories
          ?.map((category) => category.kind)
          .join(',') === 'chore,event,dinner' &&
        finalAssignedShift?.participants?.length === 1 &&
        finalAssignedShift.participants[0].displayName === 'Dev U.' &&
        finalAssignedShift.participants[0].currentUser === true,
      'Final assignments omitted the closed, ordered participant snapshot',
    );
    assert(
      !serializedFinalAssignments.includes('userID') &&
        !serializedFinalAssignments.includes('@localhost') &&
        !serializedFinalAssignments.includes('catalogRevision'),
      'Final assignments exposed private or planner-only fields',
    );
    const closedSignupStatusResponse = await fetch(
      'http://localhost:3001/api/users/signup-status/1',
      { headers: { cookie: standardCookie } },
    );
    const closedSignupStatus = await closedSignupStatusResponse.json();
    assert(
      closedSignupStatusResponse.ok &&
        closedSignupStatus.chorePlanStatus === 'closed' &&
        closedSignupStatus.choreSignupsOpen === false,
      'Closed participant signup status still reported open mutations',
    );
    const closedSignupResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/signup',
      {
        method: 'POST',
        headers: {
          cookie: standardCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ shiftIDs: [signupSource.id] }),
      },
    );
    assert(
      closedSignupResponse.status === 409,
      'Closed chore plans must reject self-service mutations',
    );
    const closedAdminMutationResponse = await mutateAdminAssignments({
      operation: 'assign',
      userID: standardAuth.user.id,
      shiftID: adminSource.id,
    });
    assert(
      closedAdminMutationResponse.status === 409,
      'Closed chore plans must reject administrative mutations',
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
    const reopenedFinalAssignmentsResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/final-assignments',
      { headers: { cookie: standardCookie } },
    );
    assert(
      reopenedFinalAssignmentsResponse.status === 409,
      'Reopened plans must stop exposing final assignments',
    );

    const releaseAuditOutput = output(
      'node scripts/production/chore-planning-release-audit.cjs',
      {
        CHORE_RELEASE_ROSTER_ID: '1',
        NODE_ENV: 'development',
        POSTGRES_CONNECTION_URL:
          'postgresql://citizix_user:S3cret@127.0.0.1:5432/citizix_db',
      },
    );
    assert(
      releaseAuditOutput.includes(
        'CHORE RELEASE AUDIT - COMPLETE (READ ONLY)',
      ) &&
        releaseAuditOutput.includes('"action":"draft_applied"') &&
        releaseAuditOutput.includes('"action":"plan_opened"') &&
        releaseAuditOutput.includes('"action":"plan_closed"') &&
        releaseAuditOutput.includes('"action":"plan_reopened"') &&
        releaseAuditOutput.includes('"action":"admin_assignment_mutated"'),
      'The read-only release audit omitted expected migration or audit state',
    );

    const backendEvents = operationalEvents(
      output('docker compose logs --no-color backend'),
    );
    const eventNames = new Set(backendEvents.map(({ event }) => event));
    [
      'chore_plan.preview_generated',
      'chore_plan.draft_applied',
      'chore_plan.lifecycle_changed',
      'chore_plan.signup_rejected',
      'chore_plan.capacity_conflict',
      'chore_plan.admin_force_completed',
    ].forEach((eventName) => {
      assert(
        eventNames.has(eventName),
        `Backend logs omitted the ${eventName} operational event`,
      );
    });
    assert(
      backendEvents.some(
        ({ event, action }) =>
          event === 'chore_plan.lifecycle_changed' && action === 'open',
      ) &&
        backendEvents.some(
          ({ event, action }) =>
            event === 'chore_plan.lifecycle_changed' && action === 'close',
        ) &&
        backendEvents.some(
          ({ event, action }) =>
            event === 'chore_plan.lifecycle_changed' && action === 'reopen',
        ),
      'Backend logs omitted a lifecycle transition',
    );
    assert(
      backendEvents.some(
        ({ event, source, conflictRule }) =>
          event === 'chore_plan.capacity_conflict' &&
          source === 'admin_assignment' &&
          conflictRule === `capacity:shift:${adminDestination.id}`,
      ),
      'Backend logs omitted the stable administrative capacity rule',
    );
    assert(
      backendEvents.some(
        ({ event, operation, bypassedRules }) =>
          event === 'chore_plan.admin_force_completed' &&
          operation === 'move' &&
          bypassedRules?.includes(`capacity:shift:${adminDestination.id}`),
      ),
      'Backend logs omitted the forced move and its bypassed rule',
    );
    assert(
      backendEvents.some(
        ({ event, reason }) =>
          event === 'chore_plan.signup_rejected' &&
          reason === 'invalid_request',
      ) &&
        backendEvents.some(
          ({ event, reason }) =>
            event === 'chore_plan.signup_rejected' &&
            reason === 'plan_not_open',
        ),
      'Backend logs omitted stable signup rejection reasons',
    );
    assert(
      backendEvents.some(
        ({ event, changed }) =>
          event === 'chore_plan.draft_applied' && changed === false,
      ),
      'Backend logs omitted the idempotent draft apply outcome',
    );
    const serializedBackendEvents = JSON.stringify(backendEvents);
    assert(
      !serializedBackendEvents.includes('Smoke-test capacity exception') &&
        !serializedBackendEvents.includes('@localhost') &&
        !serializedBackendEvents.includes('"shiftIDs"'),
      'Operational events exposed free-text reasons, email addresses, or attempted shift choices',
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
