import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express, { RequestHandler } from 'express';
import User from '../models/user/user';
import {
  createChorePlanRouter,
  ChorePlanRouteDependencies,
} from '../routes/chore_plans';
import {
  buildChorePlan,
  parseGoogleSheetID,
  scoreRowsFromCSV,
} from '../utils/chorePlan';
import ChorePlanError from '../utils/chorePlanError';
import { validateRequirements } from '../utils/chorePlanRequirements';

interface ErrorResponse {
  error: string;
}

const allowManageChorePlans = (): RequestHandler => (req, _res, next) => {
  req.user = { id: 99 } as User;
  next();
};

const validPlanInput = {
  rosterID: 1,
  camperCount: 50,
  sheetUrl: 'https://docs.google.com/spreadsheets/d/example/edit',
  requirements: { chore: 3, event: 3, dinner: 1 },
};

async function request(
  dependencies: ChorePlanRouteDependencies,
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
): Promise<{ status: number; body: ErrorResponse }> {
  const app = express();
  app.use(express.json());
  app.use(
    createChorePlanRouter({
      permissionMiddleware: allowManageChorePlans,
      ...dependencies,
    }),
  );

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json()) as ErrorResponse,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('requirement validation uses descriptive 400 errors for request and plan limits', () => {
  assert.throws(
    () => validateRequirements({ chore: -1, event: 3, dinner: 1 }),
    (error: unknown) => {
      assert.ok(error instanceof ChorePlanError);
      assert.equal(error.status, 400);
      assert.equal(
        error.message,
        'Chore requirements must be a whole number from 0 to 20.',
      );
      return true;
    },
  );

  assert.throws(
    () =>
      validateRequirements(
        { chore: 4, event: 3, dinner: 1 },
        { chore: 3, event: 3, dinner: 1 },
      ),
    (error: unknown) => {
      assert.ok(error instanceof ChorePlanError);
      assert.equal(error.status, 400);
      assert.equal(
        error.message,
        'Chore requirements must be a whole number from 0 to 3.',
      );
      return true;
    },
  );
});

test('planner input and score-sheet failures are known 4xx errors', () => {
  const expectedFailure = (status: number) => (error: unknown) => {
    assert.ok(error instanceof ChorePlanError);
    assert.equal(error.status, status);
    return true;
  };

  assert.throws(
    () => parseGoogleSheetID('not a sheet link'),
    expectedFailure(400),
  );
  assert.throws(
    () => scoreRowsFromCSV('Wrong,Columns\nA,B'),
    expectedFailure(422),
  );
  assert.throws(
    () =>
      buildChorePlan({
        rosterID: 1,
        year: 2026,
        camperCount: 1,
        sheetUrl: validPlanInput.sheetUrl,
        sheetTitle: 'Chore scores',
        requirements: { chore: 1, event: 0, dinner: 0 },
        chores: [
          {
            shift: 'Kitchen cleanup',
            position: 'Lead',
            score: 10,
            timePeriod: 'not a time',
            sourceOrder: 0,
          },
        ],
        events: [],
        dinners: [],
      }),
    expectedFailure(422),
  );
});

test('participant requirement request-shape failures return HTTP 400', async () => {
  const response = await request(
    {
      chorePlanController: {
        SetParticipantRequirements: async () => {
          assert.fail('The controller must not receive invalid requirements.');
        },
      },
    },
    '/1/participants/2/requirements',
    'PUT',
    {
      requirements: { chore: -1, event: 3, dinner: 1 },
      reason: 'Medical accommodation',
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: 'Chore requirements must be a whole number from 0 to 20.',
  });
});

test('participant requirements above the plan maximum return HTTP 400', async () => {
  const response = await request(
    {
      chorePlanController: {
        SetParticipantRequirements: async (_rosterID, userID, requirements) => {
          validateRequirements(requirements, {
            chore: 3,
            event: 3,
            dinner: 1,
          });
          return {
            userID,
            requirements,
            hasCustomRequirements: true,
            requirementExceptionReason: 'Medical accommodation',
          };
        },
      },
    },
    '/1/participants/2/requirements',
    'PUT',
    {
      requirements: { chore: 4, event: 3, dinner: 1 },
      reason: 'Medical accommodation',
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: 'Chore requirements must be a whole number from 0 to 3.',
  });
});

test('known score-sheet and lifecycle errors preserve their status and message', async (context) => {
  const knownFailures: Array<{
    name: string;
    dependencies: ChorePlanRouteDependencies;
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    expectedStatus: number;
    expectedMessage: string;
  }> = [
    {
      name: 'score-sheet validation',
      dependencies: {
        chorePlanController: {
          Preview: async () => {
            throw new ChorePlanError(
              'The score sheet is missing required columns.',
              422,
            );
          },
        },
      },
      path: '/preview',
      method: 'POST',
      body: validPlanInput,
      expectedStatus: 422,
      expectedMessage: 'The score sheet is missing required columns.',
    },
    {
      name: 'signup lifecycle conflict',
      dependencies: {
        chorePlanController: {
          CloseSignups: async () => {
            throw new ChorePlanError(
              'Open chore signups before closing the plan.',
              409,
            );
          },
        },
      },
      path: '/1/close-signups',
      method: 'POST',
      expectedStatus: 409,
      expectedMessage: 'Open chore signups before closing the plan.',
    },
  ];

  await knownFailures.reduce(
    (previousTest, failure) =>
      previousTest.then(() =>
        context.test(failure.name, async () => {
          const response = await request(
            failure.dependencies,
            failure.path,
            failure.method,
            failure.body,
          );
          assert.equal(response.status, failure.expectedStatus);
          assert.deepEqual(response.body, { error: failure.expectedMessage });
        }),
      ),
    Promise.resolve(),
  );
});

test('chore-plan routes sanitize and log unexpected failures once', async (context) => {
  const secret = 'database password appeared in an internal exception';
  const unexpectedFailure = async () => {
    throw new Error(secret);
  };
  const failures: Array<{
    name: string;
    dependencies: ChorePlanRouteDependencies;
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    fallback: string;
  }> = [
    {
      name: 'readiness',
      dependencies: {
        chorePlanReadinessController: { GetByRosterID: unexpectedFailure },
      },
      path: '/1/readiness',
      method: 'GET',
      fallback: 'Could not review chore-plan readiness.',
    },
    {
      name: 'preview',
      dependencies: {
        chorePlanController: { Preview: unexpectedFailure },
      },
      path: '/preview',
      method: 'POST',
      body: validPlanInput,
      fallback: 'Could not preview the plan.',
    },
    {
      name: 'open signups',
      dependencies: {
        chorePlanController: { OpenSignups: unexpectedFailure },
      },
      path: '/1/open-signups',
      method: 'POST',
      fallback: 'Could not open signups.',
    },
    {
      name: 'close signups',
      dependencies: {
        chorePlanController: { CloseSignups: unexpectedFailure },
      },
      path: '/1/close-signups',
      method: 'POST',
      fallback: 'Could not close signups.',
    },
    {
      name: 'generate',
      dependencies: {
        chorePlanController: { Preview: unexpectedFailure },
      },
      path: '/generate',
      method: 'POST',
      body: validPlanInput,
      fallback: 'Could not generate the plan.',
    },
  ];

  await failures.reduce(
    (previousTest, failure) =>
      previousTest.then(() =>
        context.test(failure.name, async () => {
          const originalConsoleError = console.error;
          const loggedArguments: unknown[][] = [];
          console.error = (...arguments_: unknown[]) => {
            loggedArguments.push(arguments_);
          };

          try {
            const response = await request(
              failure.dependencies,
              failure.path,
              failure.method,
              failure.body,
            );
            assert.equal(response.status, 500);
            assert.deepEqual(response.body, { error: failure.fallback });
            assert.equal(JSON.stringify(response.body).includes(secret), false);
            assert.equal(loggedArguments.length, 1);
            assert.equal(loggedArguments[0][0], failure.fallback);
          } finally {
            console.error = originalConsoleError;
          }
        }),
      ),
    Promise.resolve(),
  );
});
