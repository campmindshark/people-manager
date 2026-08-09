import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChorePlanOperationalEvent } from '../utils/chorePlanOperationalEvent';
import ChorePlanAssignmentError from '../utils/chorePlanAssignmentError';
import ChorePlanSignupError from '../utils/chorePlanSignupError';

test('chore plan operational events serialize stable structured fields', () => {
  assert.deepEqual(
    buildChorePlanOperationalEvent(
      'chore_plan.draft_applied',
      {
        actorUserID: 7,
        rosterID: 2,
        changed: true,
        requirements: { chore: 3, event: 3, dinner: 1 },
      },
      'info',
      new Date('2026-08-07T12:00:00.000Z'),
    ),
    {
      timestamp: '2026-08-07T12:00:00.000Z',
      level: 'info',
      event: 'chore_plan.draft_applied',
      actorUserID: 7,
      rosterID: 2,
      changed: true,
      requirements: { chore: 3, event: 3, dinner: 1 },
    },
  );
});

test('operational conflict metadata uses stable rule codes', () => {
  const signupError = new ChorePlanSignupError(
    'This message is safe for the client but is not an operational key.',
    409,
    'capacity',
  );
  const assignmentError = new ChorePlanAssignmentError(
    'This message is safe for the client but is not an operational key.',
    409,
    ['attendance:user:7:shift:42', 'capacity:shift:42'],
  );

  assert.equal(signupError.reason, 'capacity');
  assert.deepEqual(assignmentError.conflictRules, [
    'attendance:user:7:shift:42',
    'capacity:shift:42',
  ]);
});
