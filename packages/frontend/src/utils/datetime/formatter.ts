import { BM_TIMEZONE } from 'backend/utils/burnDates';

const options: Intl.DateTimeFormatOptions = {
  timeZone: BM_TIMEZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true,
  timeZoneName: 'short',
};

const BurningManDateFormatter = new Intl.DateTimeFormat('en-US', options);

export default BurningManDateFormatter;

const timeOfDayOptions: Intl.DateTimeFormatOptions = {
  timeZone: BM_TIMEZONE,
  hour: 'numeric',
  minute: 'numeric',
  hour12: true,
};

export const TimeOfDayFormatter = new Intl.DateTimeFormat(
  'en-US',
  timeOfDayOptions,
);

export const EventDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BM_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

export const EventGridTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BM_TIMEZONE,
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
});
