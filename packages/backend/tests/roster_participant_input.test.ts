import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRosterParticipantBulkRemovalInput } from '../utils/rosterParticipantInput';

test('bulk roster removal accepts only positive integer participant IDs', () => {
  assert.deepEqual(parseRosterParticipantBulkRemovalInput('7', [2, 3]), {
    rosterID: 7,
    userIDs: [2, 3],
  });

  [
    [],
    [true],
    [null],
    ['2'],
    [0],
    [-1],
    [1.5],
    [Number.MAX_SAFE_INTEGER + 1],
  ].forEach((userIDs) => {
    assert.equal(parseRosterParticipantBulkRemovalInput('7', userIDs), null);
  });
  assert.equal(parseRosterParticipantBulkRemovalInput('7x', [2]), null);
  assert.equal(parseRosterParticipantBulkRemovalInput('0', [2]), null);
});
