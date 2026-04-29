import { DateTime } from 'luxon';

// Burning Man takes place in Black Rock City, Nevada (Pacific Time).
// Anchoring all calendar boundaries to this zone prevents off-by-one
// errors when consumers convert to/from UTC.
export const BM_TIMEZONE = 'America/Los_Angeles';

export interface BurnDates {
  // Monday of build week — the earliest day a participant can plausibly
  // arrive on Early Arrival.
  earlyArrivalStart: Date;
  // Sunday gates open (general public arrival).
  gatesOpen: Date;
  // Wednesday of event week — the latest day arrival is allowed.
  eventWednesday: Date;
  // Saturday Man burn.
  manBurn: Date;
  // Sunday Temple burn.
  templeBurn: Date;
  // Monday Labor Day (event ends).
  laborDay: Date;
}

export interface DateTimePickerBounds {
  // Start of EA Monday (00:00:00 PT).
  arrivalMin: Date;
  // End of event Wednesday (23:59:59.999 PT).
  arrivalMax: Date;
  // End of (Man Saturday + 3 days) (23:59:59.999 PT).
  departureMaxEnd: Date;
}

// Returns the first Monday of September in BM_TIMEZONE for the given year.
// Burning Man traditionally ends on US Labor Day, which is the first Monday
// of September.
export function getLaborDay(year: number): DateTime {
  const sept1 = DateTime.fromObject(
    { year, month: 9, day: 1 },
    { zone: BM_TIMEZONE },
  );
  // Luxon weekday: 1 = Monday, ..., 7 = Sunday.
  const offsetToMonday = (1 - sept1.weekday + 7) % 7;
  return sept1.plus({ days: offsetToMonday }).startOf('day');
}

// Returns the canonical Burning Man calendar dates for a given roster year,
// each anchored at start-of-day Pacific Time. Derived from the Labor Day
// rule that has held since the 1990s:
//   gatesOpen   = laborDay - 8 days (Sunday)
//   manBurn     = laborDay - 2 days (Saturday)
//   templeBurn  = laborDay - 1 day  (Sunday)
//   earlyArrivalStart = gatesOpen - 6 days (Monday)
//   eventWednesday    = gatesOpen + 3 days (Wednesday)
export function getBurnDates(rosterYear: number): BurnDates {
  const laborDay = getLaborDay(rosterYear);
  const gatesOpen = laborDay.minus({ days: 8 });
  const earlyArrivalStart = gatesOpen.minus({ days: 6 });
  const eventWednesday = gatesOpen.plus({ days: 3 });
  const manBurn = laborDay.minus({ days: 2 });
  const templeBurn = laborDay.minus({ days: 1 });

  return {
    earlyArrivalStart: earlyArrivalStart.toJSDate(),
    gatesOpen: gatesOpen.toJSDate(),
    eventWednesday: eventWednesday.toJSDate(),
    manBurn: manBurn.toJSDate(),
    templeBurn: templeBurn.toJSDate(),
    laborDay: laborDay.toJSDate(),
  };
}

// Returns picker boundaries (JS Date) for use as MUI DateTimePicker
// minDateTime / maxDateTime props. Maxes are end-of-day so the entire
// Pacific calendar day is selectable.
export function getDateTimePickerBounds(
  rosterYear: number,
): DateTimePickerBounds {
  const laborDay = getLaborDay(rosterYear);
  const gatesOpen = laborDay.minus({ days: 8 });
  const earlyArrivalStart = gatesOpen.minus({ days: 6 });
  const eventWednesday = gatesOpen.plus({ days: 3 });
  const manBurn = laborDay.minus({ days: 2 });
  // +3 days past Man Saturday is the latest allowed departure.
  const departureMaxDay = manBurn.plus({ days: 3 });

  return {
    arrivalMin: earlyArrivalStart.startOf('day').toJSDate(),
    arrivalMax: eventWednesday.endOf('day').toJSDate(),
    departureMaxEnd: departureMaxDay.endOf('day').toJSDate(),
  };
}

// Ordinal suffix for English day-of-month: 1st, 2nd, 3rd, 4th, ...
// Handles the 11th/12th/13th irregulars correctly (they take "th",
// not "st"/"nd"/"rd").
function ordinalSuffix(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

// Formats a Date as a human-friendly burn-date label such as
// "Sunday, August 30th", always rendered in BM_TIMEZONE so the weekday
// and day number match what attendees see on the playa.
export function formatBurnDateLabel(date: Date): string {
  const dt = DateTime.fromJSDate(date).setZone(BM_TIMEZONE);
  const weekdayMonth = dt.toFormat('cccc, LLLL');
  return `${weekdayMonth} ${dt.day}${ordinalSuffix(dt.day)}`;
}
