import {
  shiftTimeRangeContains,
  shiftTimeRangesOverlap,
} from 'backend/utils/shiftTime';

function timeRange(startTime: string, endTime: string) {
  return { startTime, endTime };
}

test('detects identical and partially overlapping shift times', () => {
  const first = timeRange(
    '2026-08-24T17:00:00.000Z',
    '2026-08-24T19:00:00.000Z',
  );

  expect(shiftTimeRangesOverlap(first, first)).toBe(true);
  expect(
    shiftTimeRangesOverlap(
      first,
      timeRange('2026-08-24T18:00:00.000Z', '2026-08-24T20:00:00.000Z'),
    ),
  ).toBe(true);
});

test('allows adjacent and separate shift times', () => {
  const first = timeRange(
    '2026-08-24T17:00:00.000Z',
    '2026-08-24T19:00:00.000Z',
  );

  expect(
    shiftTimeRangesOverlap(
      first,
      timeRange('2026-08-24T19:00:00.000Z', '2026-08-24T20:00:00.000Z'),
    ),
  ).toBe(false);
  expect(
    shiftTimeRangesOverlap(
      first,
      timeRange('2026-08-25T17:00:00.000Z', '2026-08-25T19:00:00.000Z'),
    ),
  ).toBe(false);
});

test('rejects invalid shift time ranges', () => {
  expect(() =>
    shiftTimeRangesOverlap(
      timeRange('2026-08-24T19:00:00.000Z', '2026-08-24T17:00:00.000Z'),
      timeRange('2026-08-24T17:00:00.000Z', '2026-08-24T18:00:00.000Z'),
    ),
  ).toThrow('Shift time ranges must have valid start and end times.');
});

test('allows shifts fully contained within an attendance window', () => {
  const attendanceWindow = timeRange(
    '2026-08-24T17:00:00.000Z',
    '2026-08-30T19:00:00.000Z',
  );

  expect(
    shiftTimeRangeContains(
      attendanceWindow,
      timeRange('2026-08-24T17:00:00.000Z', '2026-08-24T19:00:00.000Z'),
    ),
  ).toBe(true);
  expect(
    shiftTimeRangeContains(
      attendanceWindow,
      timeRange('2026-08-30T17:00:00.000Z', '2026-08-30T19:00:00.000Z'),
    ),
  ).toBe(true);
});

test('rejects shifts that start before arrival or end after departure', () => {
  const attendanceWindow = timeRange(
    '2026-08-24T17:00:00.000Z',
    '2026-08-30T19:00:00.000Z',
  );

  expect(
    shiftTimeRangeContains(
      attendanceWindow,
      timeRange('2026-08-24T16:00:00.000Z', '2026-08-24T18:00:00.000Z'),
    ),
  ).toBe(false);
  expect(
    shiftTimeRangeContains(
      attendanceWindow,
      timeRange('2026-08-30T18:00:00.000Z', '2026-08-30T20:00:00.000Z'),
    ),
  ).toBe(false);
});
