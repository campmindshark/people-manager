import { execFileSync, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function run(command) {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

function runDatabaseCommand(sql) {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'citizix_user',
      '-d',
      'citizix_db',
      '-c',
      sql,
    ],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  );
}

function queryDatabaseNumber(sql) {
  const output = execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-U',
      'citizix_user',
      '-d',
      'citizix_db',
      '-c',
      sql,
    ],
    {
      encoding: 'utf8',
      cwd: process.cwd(),
    },
  );
  const value = Number(output.trim());
  assert(
    Number.isFinite(value),
    `Expected a database number, received ${output}`,
  );
  return value;
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

    const memberLoginResponse = await fetch(
      'http://localhost:3001/api/auth/dev/login/standard',
      { redirect: 'manual' },
    );
    assert(
      memberLoginResponse.status === 302 || memberLoginResponse.status === 303,
      'Expected redirect response from member dev login endpoint',
    );
    const memberCookie = memberLoginResponse.headers.get('set-cookie');
    assert(memberCookie, 'Member dev login did not return a session cookie');
    const memberSessionCookie = memberCookie.split(';')[0];
    const memberAuthCheckResponse = await fetch(
      'http://localhost:3001/api/auth/login/success',
      {
        headers: { cookie: memberSessionCookie },
      },
    );
    assert(
      memberAuthCheckResponse.ok,
      'Member auth check failed after dev login',
    );
    const memberAuthCheck = await memberAuthCheckResponse.json();
    const unassignedMemberID = Number(memberAuthCheck.user?.id);
    assert(
      Number.isInteger(unassignedMemberID) && unassignedMemberID > 0,
      'Member auth check returned an invalid user ID',
    );

    const rosterResponse = await fetch('http://localhost:3001/api/rosters/2', {
      headers: { cookie: sessionCookie },
    });
    assert(rosterResponse.ok, 'Expected roster 2 to exist after seed step');

    const userID = Number(authCheck.user.id);
    assert(
      Number.isInteger(userID) && userID > 0,
      'Auth check returned an invalid user ID',
    );
    const authenticatedHeaders = {
      cookie: sessionCookie,
      'content-type': 'application/json',
    };
    const verificationResponse = await fetch(
      `http://localhost:3001/api/users/verify/${userID}`,
      {
        method: 'POST',
        headers: authenticatedHeaders,
      },
    );
    assert(
      verificationResponse.ok,
      'Could not verify the integration-test user',
    );

    runDatabaseCommand(`
      WITH integration_plan AS (
        INSERT INTO chore_plans (
          "rosterID",
          "camperCount",
          "sheetUrl",
          "sheetTitle",
          status,
          "openedAt"
        ) VALUES (
          1,
          1,
          'integration://priority-wave',
          'Integration priority wave',
          'open',
          CURRENT_TIMESTAMP
        )
        RETURNING id
      )
      UPDATE schedules
      SET
        "chorePlanID" = integration_plan.id,
        "plannerKey" = CASE
          WHEN schedules.id = 1 THEN 'chore|integration'
          ELSE 'event|integration'
        END
      FROM integration_plan
      WHERE schedules.id IN (1, 2);

      INSERT INTO roster_participants (
        "rosterID",
        "userID",
        "estimatedArrivalDate",
        "estimatedDepartureDate"
      ) VALUES
        (
          1,
          ${userID},
          '2024-01-01T00:00:00.000Z',
          '2025-01-01T00:00:00.000Z'
        ),
        (
          1,
          ${unassignedMemberID},
          '2024-01-01T00:00:00.000Z',
          '2025-01-01T00:00:00.000Z'
        );
    `);
    const eventShiftID = queryDatabaseNumber(`
      SELECT MIN(id)
      FROM shifts
      WHERE "scheduleID" = 2
    `);

    const unauthorizedReassignmentResponse = await fetch(
      'http://localhost:3001/api/shifts/reassign',
      {
        method: 'POST',
        headers: {
          cookie: memberSessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          source: { shiftID: 1, userID },
          destinationShiftID: 2,
        }),
      },
    );
    assert(
      unauthorizedReassignmentResponse.status === 403,
      'A non-admin must not be able to reassign members',
    );

    const assignUnassignedMemberResponse = await fetch(
      'http://localhost:3001/api/shifts/reassign',
      {
        method: 'POST',
        headers: authenticatedHeaders,
        body: JSON.stringify({
          source: { shiftID: 2, userID: unassignedMemberID },
          destinationShiftID: 3,
        }),
      },
    );
    assert(
      assignUnassignedMemberResponse.status === 409,
      'Admin reassignment must reject a member without the claimed source assignment',
    );
    const untouchedDestinationResponse = await fetch(
      'http://localhost:3001/api/shifts/3/participants',
      { headers: authenticatedHeaders },
    );
    assert(
      untouchedDestinationResponse.ok,
      'Could not inspect the rejected reassignment destination',
    );
    const untouchedDestinationParticipants =
      await untouchedDestinationResponse.json();
    assert(
      !untouchedDestinationParticipants.some(
        (participant) => Number(participant.id) === unassignedMemberID,
      ),
      'A rejected admin reassignment must not create an assignment',
    );

    const groupResponse = await fetch('http://localhost:3001/api/groups', {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        name: 'Integration priority wave',
        description: 'Exercises legacy staged signup opening.',
        rosterID: 1,
        shiftSignupOpenDate: '2999-01-01T00:00:00.000Z',
      }),
    });
    assert(groupResponse.ok, 'Could not create the integration-test group');
    const group = await groupResponse.json();

    const membershipResponse = await fetch(
      `http://localhost:3001/api/groups/${group.id}/members/${userID}`,
      {
        method: 'POST',
        headers: authenticatedHeaders,
      },
    );
    assert(
      membershipResponse.ok,
      'Could not assign the integration-test user to a signup group',
    );

    const closedAccessResponse = await fetch(
      'http://localhost:3001/api/users/can-signup-for-shifts/1',
      { headers: authenticatedHeaders },
    );
    assert(closedAccessResponse.ok, 'Could not read staged signup access');
    assert(
      (await closedAccessResponse.json()) === false,
      'A future priority wave must remain closed',
    );

    const globallyOpenChoreShiftsResponse = await fetch(
      'http://localhost:3001/api/schedules/1/shifts',
      { headers: authenticatedHeaders },
    );
    assert(
      globallyOpenChoreShiftsResponse.ok,
      'Could not read the globally open chore signup sheet',
    );
    const globallyOpenChoreShifts =
      await globallyOpenChoreShiftsResponse.json();
    assert(
      globallyOpenChoreShifts.length > 0 &&
        globallyOpenChoreShifts.every((shift) => shift.signupOpen === true),
      'An open chore plan must appear open regardless of the user group wave',
    );

    const earlySignupResponse = await fetch(
      'http://localhost:3001/api/shifts/chore-signup',
      {
        method: 'PATCH',
        headers: authenticatedHeaders,
        body: JSON.stringify({ addShiftIDs: [1], removeShiftIDs: [] }),
      },
    );
    assert(
      earlySignupResponse.ok,
      'Opening a chore plan must allow signup regardless of the user group wave',
    );

    const openGroupResponse = await fetch(
      `http://localhost:3001/api/groups/${group.id}`,
      {
        method: 'PUT',
        headers: authenticatedHeaders,
        body: JSON.stringify({
          shiftSignupOpenDate: '2000-01-01T00:00:00.000Z',
        }),
      },
    );
    assert(openGroupResponse.ok, 'Could not open the integration-test wave');

    const openAccessResponse = await fetch(
      'http://localhost:3001/api/users/can-signup-for-shifts/1',
      { headers: authenticatedHeaders },
    );
    assert(openAccessResponse.ok, 'Could not reread staged signup access');
    assert(
      (await openAccessResponse.json()) === true,
      'A past priority-wave date must allow signup',
    );

    const wrongRosterAccessResponse = await fetch(
      'http://localhost:3001/api/users/can-signup-for-shifts/2',
      { headers: authenticatedHeaders },
    );
    assert(
      wrongRosterAccessResponse.ok,
      'Could not read signup access for another roster',
    );
    assert(
      (await wrongRosterAccessResponse.json()) === false,
      'Group membership must not grant access to another roster',
    );

    runDatabaseCommand(`
      INSERT INTO shift_participants ("shiftID", "userID")
      VALUES (2, ${unassignedMemberID});
    `);

    const swapResponse = await fetch('http://localhost:3001/api/shifts/swap', {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        assignments: [
          { shiftID: 1, userID },
          { shiftID: 2, userID: unassignedMemberID },
        ],
      }),
    });
    assert(swapResponse.ok, 'Admin must be able to swap assigned members');

    const moveResponse = await fetch(
      'http://localhost:3001/api/shifts/reassign',
      {
        method: 'POST',
        headers: authenticatedHeaders,
        body: JSON.stringify({
          source: { shiftID: 2, userID },
          destinationShiftID: eventShiftID,
        }),
      },
    );
    assert(
      moveResponse.ok,
      'Admin must be able to move an assigned member into an incomplete category',
    );

    const movedDestinationResponse = await fetch(
      `http://localhost:3001/api/shifts/${eventShiftID}/participants`,
      { headers: authenticatedHeaders },
    );
    assert(
      movedDestinationResponse.ok,
      'Could not inspect the successful reassignment destination',
    );
    const movedDestinationParticipants = await movedDestinationResponse.json();
    assert(
      movedDestinationParticipants.some(
        (participant) => Number(participant.id) === userID,
      ),
      'A successful admin move must preserve and relocate the assignment',
    );

    const assignmentCount = () =>
      queryDatabaseNumber(`
        SELECT COUNT(*)
        FROM shift_participants
        JOIN shifts ON shift_participants."shiftID" = shifts.id
        JOIN schedules ON shifts."scheduleID" = schedules.id
        WHERE shift_participants."userID" = ${userID}
          AND schedules."rosterID" = 1
      `);
    const participantCount = () =>
      queryDatabaseNumber(`
        SELECT COUNT(*)
        FROM roster_participants
        WHERE "userID" = ${userID}
          AND "rosterID" = 1
      `);
    const participantPayload = {
      probabilityOfAttending: 100,
      hasTicket: false,
      hasVehiclePass: false,
      extraTickets: false,
      yearsAttended: 0,
      yearsAtCamp: [],
      estimatedArrivalDate: '2024-01-01T00:00:00.000Z',
      estimatedDepartureDate: '2025-01-01T00:00:00.000Z',
      sleepingArrangement: 'Integration test',
      earlyArrivalInterest: false,
      postBurnInterest: false,
      hasReadEssentialMindshark: true,
      agreesToParticipateInTearDown: true,
      agreesToParticipateInShifts: true,
      agreesToPayDues: true,
    };
    const saveParticipant = (payload = participantPayload) =>
      fetch('http://localhost:3001/api/roster_participants/1', {
        method: 'POST',
        headers: authenticatedHeaders,
        body: JSON.stringify(payload),
      });
    const signupForIntegrationShift = () =>
      fetch('http://localhost:3001/api/shifts/chore-signup', {
        method: 'PATCH',
        headers: authenticatedHeaders,
        body: JSON.stringify({ addShiftIDs: [1], removeShiftIDs: [] }),
      });

    assert(assignmentCount() === 1, 'Expected the seeded chore assignment');

    const assignedShiftStart = new Date(
      queryDatabaseNumber(`
        SELECT EXTRACT(EPOCH FROM shifts."startTime") * 1000
        FROM shift_participants
        JOIN shifts ON shift_participants."shiftID" = shifts.id
        JOIN schedules ON shifts."scheduleID" = schedules.id
        WHERE shift_participants."userID" = ${userID}
          AND schedules."rosterID" = 1
        LIMIT 1
      `),
    ).toISOString();
    const assignedShiftEnd = new Date(
      queryDatabaseNumber(`
        SELECT EXTRACT(EPOCH FROM shifts."endTime") * 1000
        FROM shift_participants
        JOIN shifts ON shift_participants."shiftID" = shifts.id
        JOIN schedules ON shifts."scheduleID" = schedules.id
        WHERE shift_participants."userID" = ${userID}
          AND schedules."rosterID" = 1
        LIMIT 1
      `),
    ).toISOString();
    const exactAttendanceResponse = await saveParticipant({
      ...participantPayload,
      estimatedArrivalDate: assignedShiftStart,
      estimatedDepartureDate: assignedShiftEnd,
    });
    assert(
      exactAttendanceResponse.ok,
      'Could not save an exact absolute attendance window',
    );
    const exactAttendanceResult = await exactAttendanceResponse.json();
    assert(
      exactAttendanceResult.removedAssignmentCount === 0,
      'An absolute attendance window must not be shifted before reconciliation',
    );
    assert(
      assignmentCount() === 1,
      'An assignment inside the absolute attendance window must be retained',
    );

    const closePlanResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/close-signups',
      { method: 'POST', headers: authenticatedHeaders },
    );
    assert(closePlanResponse.ok, 'Could not close the integration chore plan');

    const closedPlanEditResponse = await fetch(
      'http://localhost:3001/api/shifts/chore-signup',
      {
        method: 'PATCH',
        headers: authenticatedHeaders,
        body: JSON.stringify({ addShiftIDs: [], removeShiftIDs: [1] }),
      },
    );
    assert(
      closedPlanEditResponse.status === 409,
      'The server must reject assignment removal after a plan is closed',
    );
    assert(
      assignmentCount() === 1,
      'A rejected closed-plan edit must leave the assignment intact',
    );

    const reopenPlanResponse = await fetch(
      'http://localhost:3001/api/chore-plans/1/open-signups',
      { method: 'POST', headers: authenticatedHeaders },
    );
    assert(
      reopenPlanResponse.ok,
      'Could not reopen the integration chore plan',
    );

    const attendanceUpdateResponse = await saveParticipant({
      ...participantPayload,
      estimatedArrivalDate: '2024-12-01T00:00:00.000Z',
      estimatedDepartureDate: '2024-12-02T00:00:00.000Z',
    });
    assert(attendanceUpdateResponse.ok, 'Could not update attendance dates');
    const attendanceUpdateResult = await attendanceUpdateResponse.json();
    assert(
      attendanceUpdateResult.removedAssignmentCount === 1,
      'Attendance updates must report removed assignments',
    );
    assert(
      assignmentCount() === 0,
      'Attendance changes must remove assignments outside the new window',
    );

    assert((await saveParticipant()).ok, 'Could not restore attendance dates');
    assert(
      (await signupForIntegrationShift()).ok,
      'Could not restore the chore assignment before dropout',
    );
    const dropoutResponse = await fetch(
      'http://localhost:3001/api/rosters/1/drop-out',
      { method: 'POST', headers: authenticatedHeaders },
    );
    assert(dropoutResponse.ok, 'Could not drop out the integration-test user');
    const dropoutResult = await dropoutResponse.json();
    assert(
      dropoutResult.removedAssignmentCount === 1,
      'Dropout must report the removed chore assignment',
    );
    assert(assignmentCount() === 0, 'Dropout must remove chore assignments');
    assert(participantCount() === 0, 'Dropout must remove roster signup');

    assert((await saveParticipant()).ok, 'Could not rejoin the roster');
    assert(
      (await signupForIntegrationShift()).ok,
      'Could not restore the chore assignment before admin removal',
    );
    const adminRemovalResponse = await fetch(
      `http://localhost:3001/api/roster_participants/1/users/${userID}`,
      { method: 'DELETE', headers: authenticatedHeaders },
    );
    assert(adminRemovalResponse.ok, 'Could not administratively remove user');
    const adminRemovalResult = await adminRemovalResponse.json();
    assert(
      adminRemovalResult.removedAssignmentCount === 1,
      'Administrative removal must report the removed chore assignment',
    );
    assert(
      assignmentCount() === 0,
      'Administrative removal must remove chore assignments',
    );
    assert(
      participantCount() === 0,
      'Administrative removal must remove roster signup',
    );

    console.log('Integration smoke test passed.');
  } finally {
    run('docker compose down -v --remove-orphans');
  }
}

runIntegrationTest().catch((error) => {
  console.error('Integration smoke test failed:', error);
  process.exit(1);
});
