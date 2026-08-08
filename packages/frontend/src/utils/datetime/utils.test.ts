import utcDateToDateTimeInTimezone, {
  addEventCalendarDays,
  browserLocalInputToEventTime,
  endOfEventDay,
  eventCalendarDate,
  startOfEventDay,
} from './utils';

test('utcDateToDateTimeInTimezone uses Los Angeles winter offset', () => {
  const testDate = new Date('2021-01-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Los_Angeles');

  expect(dateTime.toISO()).toBe('2021-01-01T01:00:00.000-08:00');
});

test('utcDateToDateTimeInTimezone uses Denver winter offset', () => {
  const testDate = new Date('2021-01-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Denver');

  expect(dateTime.toISO()).toBe('2021-01-01T02:00:00.000-07:00');
});

test('utcDateToDateTimeInTimezone uses daylight-saving offset', () => {
  const testDate = new Date('2021-07-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Denver');

  expect(dateTime.toISO()).toBe('2021-07-01T03:00:00.000-06:00');
});

test('event calendar dates are anchored to Pacific Time', () => {
  expect(eventCalendarDate(2026, 8, 24).toISOString()).toBe(
    '2026-08-24T07:00:00.000Z',
  );
  expect(
    startOfEventDay(new Date('2026-08-24T20:00:00.000Z')).toISOString(),
  ).toBe('2026-08-24T07:00:00.000Z');
  expect(
    endOfEventDay(new Date('2026-08-24T20:00:00.000Z')).toISOString(),
  ).toBe('2026-08-25T06:59:59.999Z');
});

test('event calendar day changes respect Pacific daylight-saving changes', () => {
  expect(
    addEventCalendarDays(new Date('2026-10-31T07:00:00.000Z'), 2).toISOString(),
  ).toBe('2026-11-02T08:00:00.000Z');
});

test('browser-local group input is reinterpreted as Pacific Time', () => {
  expect(
    browserLocalInputToEventTime(
      '2026-08-24T13:00:00.000Z',
      'America/New_York',
    ).toISOString(),
  ).toBe('2026-08-24T16:00:00.000Z');
  expect(
    browserLocalInputToEventTime(
      '2026-01-15T14:00:00.000Z',
      'America/New_York',
    ).toISOString(),
  ).toBe('2026-01-15T17:00:00.000Z');
});
