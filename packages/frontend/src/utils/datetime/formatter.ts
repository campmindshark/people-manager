const options: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Los_Angeles', // Set the timezone to Reno, Nevada (America/Los_Angeles)
  weekday: 'long', // Format options
  // year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};

const BurningManDateFormatter = new Intl.DateTimeFormat('en-US', options);

export default BurningManDateFormatter;

const timeOfDayOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Los_Angeles', // Set the timezone to Reno, Nevada (America/Los_Angeles)
  hour: 'numeric',
  minute: 'numeric',
};

export const TimeOfDayFormatter = new Intl.DateTimeFormat(
  'en-US',
  timeOfDayOptions,
);
