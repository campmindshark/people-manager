import { utcDateToDateTimeInTimezone } from '../datetime/utils';

test('utcDateToDateTimeInTimezone LA', async () => {
  const testDate = new Date('2021-01-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Los_Angeles');

  expect(dateTime.toISO()).toBe('2021-01-01T02:00:00.000-08:00');
});

test('utcDateToDateTimeInTimezone Denver', async () => {
  const testDate = new Date('2021-01-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Denver');

  expect(dateTime.toISO()).toBe('2021-01-01T03:00:00.000-07:00');
});

test('utcStringToTimezoneSpecificDate NYC', async () => {
  const testDate = new Date('2021-01-01T09:00:00Z');
  const dateTime = utcDateToDateTimeInTimezone(testDate, 'America/Denver');

  expect(dateTime.toISO()).toBe('2021-01-01T03:00:00.000-07:00');
});
