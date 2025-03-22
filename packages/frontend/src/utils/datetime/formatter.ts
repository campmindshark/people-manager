const options: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true,
};

const BurningManDateFormatter = new Intl.DateTimeFormat('en-US', options);

export default BurningManDateFormatter;

const timeOfDayOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true,
};

export const TimeOfDayFormatter = new Intl.DateTimeFormat(
  'en-US',
  timeOfDayOptions,
);
