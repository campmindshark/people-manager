import { attendanceRemovalMessage } from './RosterSignupFormV2';

test('reports one attendance-related shift removal', () => {
  expect(attendanceRemovalMessage(1)).toBe(
    'Your attendance update removed 1 shift assignment that is now outside your attendance window.',
  );
});

test('reports multiple attendance-related shift removals', () => {
  expect(attendanceRemovalMessage(3)).toBe(
    'Your attendance update removed 3 shift assignments that are now outside your attendance window.',
  );
});
