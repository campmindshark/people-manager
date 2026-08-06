import utcDateToDateTimeInTimezone from './utils';

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
