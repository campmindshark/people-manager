import assert from 'node:assert/strict';
import test from 'node:test';
import parseEventDateTime from '../utils/eventTime';

test('naive summer event times are interpreted as Pacific Daylight Time', () => {
  assert.equal(
    parseEventDateTime('2026-08-24T09:00:00', 'Start time').toISOString(),
    '2026-08-24T16:00:00.000Z',
  );
});

test('naive winter signup times are interpreted as Pacific Standard Time', () => {
  assert.equal(
    parseEventDateTime('2026-01-15T09:00:00', 'Signup time').toISOString(),
    '2026-01-15T17:00:00.000Z',
  );
});

test('explicit offsets preserve their absolute instant', () => {
  assert.equal(
    parseEventDateTime('2026-08-24T12:00:00-04:00', 'Start time').toISOString(),
    '2026-08-24T16:00:00.000Z',
  );
});

test('invalid event times are rejected', () => {
  assert.throws(
    () => parseEventDateTime('not-a-date', 'Start time'),
    /Start time must be a valid Pacific date and time/,
  );
});
