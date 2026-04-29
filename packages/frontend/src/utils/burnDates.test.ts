import { DateTime } from 'luxon';
import {
  BM_TIMEZONE,
  formatBurnDateLabel,
  getBurnDates,
  getDateTimePickerBounds,
  getLaborDay,
} from 'backend/utils/burnDates';

const formatPT = (date: Date, fmt: string): string =>
  DateTime.fromJSDate(date).setZone(BM_TIMEZONE).toFormat(fmt);

const isoPT = (date: Date): string =>
  DateTime.fromJSDate(date).setZone(BM_TIMEZONE).toISO() ?? '';

describe('getLaborDay', () => {
  it('returns Sept 2 2024 (Sept 1 was a Sunday)', () => {
    const ld = getLaborDay(2024);
    expect(ld.toISODate()).toBe('2024-09-02');
    expect(ld.weekdayLong).toBe('Monday');
  });

  it('returns Sept 1 2025 (Sept 1 was a Monday)', () => {
    const ld = getLaborDay(2025);
    expect(ld.toISODate()).toBe('2025-09-01');
    expect(ld.weekdayLong).toBe('Monday');
  });

  it('returns Sept 7 2026 (Sept 1 is a Tuesday)', () => {
    const ld = getLaborDay(2026);
    expect(ld.toISODate()).toBe('2026-09-07');
    expect(ld.weekdayLong).toBe('Monday');
  });

  it('returns Sept 6 2027 (Sept 1 is a Wednesday)', () => {
    const ld = getLaborDay(2027);
    expect(ld.toISODate()).toBe('2027-09-06');
    expect(ld.weekdayLong).toBe('Monday');
  });

  it('returns Sept 4 2028 (Sept 1 is a Friday)', () => {
    const ld = getLaborDay(2028);
    expect(ld.toISODate()).toBe('2028-09-04');
    expect(ld.weekdayLong).toBe('Monday');
  });
});

describe('getBurnDates', () => {
  it('matches the 2025 strings used by the legacy hardcoded helper text', () => {
    const dates = getBurnDates(2025);
    expect(formatPT(dates.gatesOpen, 'cccc, yyyy-LL-dd')).toBe(
      'Sunday, 2025-08-24',
    );
    expect(formatPT(dates.templeBurn, 'cccc, yyyy-LL-dd')).toBe(
      'Sunday, 2025-08-31',
    );
    expect(formatPT(dates.manBurn, 'cccc, yyyy-LL-dd')).toBe(
      'Saturday, 2025-08-30',
    );
    expect(formatPT(dates.earlyArrivalStart, 'cccc, yyyy-LL-dd')).toBe(
      'Monday, 2025-08-18',
    );
    expect(formatPT(dates.eventWednesday, 'cccc, yyyy-LL-dd')).toBe(
      'Wednesday, 2025-08-27',
    );
    expect(formatPT(dates.laborDay, 'cccc, yyyy-LL-dd')).toBe(
      'Monday, 2025-09-01',
    );
  });

  it('matches the official Burning Man 2026 schedule', () => {
    const dates = getBurnDates(2026);
    expect(formatPT(dates.gatesOpen, 'cccc, yyyy-LL-dd')).toBe(
      'Sunday, 2026-08-30',
    );
    expect(formatPT(dates.earlyArrivalStart, 'cccc, yyyy-LL-dd')).toBe(
      'Monday, 2026-08-24',
    );
    expect(formatPT(dates.eventWednesday, 'cccc, yyyy-LL-dd')).toBe(
      'Wednesday, 2026-09-02',
    );
    expect(formatPT(dates.manBurn, 'cccc, yyyy-LL-dd')).toBe(
      'Saturday, 2026-09-05',
    );
    expect(formatPT(dates.templeBurn, 'cccc, yyyy-LL-dd')).toBe(
      'Sunday, 2026-09-06',
    );
    expect(formatPT(dates.laborDay, 'cccc, yyyy-LL-dd')).toBe(
      'Monday, 2026-09-07',
    );
  });

  it('anchors every date at midnight Pacific Time (no off-by-one drift)', () => {
    const dates = getBurnDates(2026);
    Object.values(dates).forEach((date) => {
      expect(formatPT(date, 'HH:mm:ss.SSS')).toBe('00:00:00.000');
    });
  });

  it('returns dates that are always in PDT (-07:00) for the burn week', () => {
    const dates = getBurnDates(2026);
    Object.values(dates).forEach((date) => {
      expect(isoPT(date)).toMatch(/-07:00$/);
    });
  });
});

describe('getDateTimePickerBounds', () => {
  it('arrivalMin is start of EA Monday Pacific (2026)', () => {
    const bounds = getDateTimePickerBounds(2026);
    expect(formatPT(bounds.arrivalMin, 'yyyy-LL-dd HH:mm:ss.SSS ZZ')).toBe(
      '2026-08-24 00:00:00.000 -07:00',
    );
  });

  it('arrivalMax is end of event Wednesday Pacific (2026)', () => {
    const bounds = getDateTimePickerBounds(2026);
    expect(formatPT(bounds.arrivalMax, 'yyyy-LL-dd HH:mm:ss.SSS ZZ')).toBe(
      '2026-09-02 23:59:59.999 -07:00',
    );
  });

  it('departureMaxEnd is end of (Man Saturday + 3 days) Pacific (2026)', () => {
    const bounds = getDateTimePickerBounds(2026);
    expect(formatPT(bounds.departureMaxEnd, 'yyyy-LL-dd HH:mm:ss.SSS ZZ')).toBe(
      '2026-09-08 23:59:59.999 -07:00',
    );
  });

  it('arrivalMin precedes arrivalMax which precedes departureMaxEnd', () => {
    const bounds = getDateTimePickerBounds(2026);
    expect(bounds.arrivalMin.getTime()).toBeLessThan(
      bounds.arrivalMax.getTime(),
    );
    expect(bounds.arrivalMax.getTime()).toBeLessThan(
      bounds.departureMaxEnd.getTime(),
    );
  });
});

describe('formatBurnDateLabel', () => {
  const labelForPTDay = (year: number, month: number, day: number): string => {
    const dt = DateTime.fromObject(
      { year, month, day },
      { zone: BM_TIMEZONE },
    ).startOf('day');
    return formatBurnDateLabel(dt.toJSDate());
  };

  it('formats as "Weekday, Month Nth"', () => {
    expect(labelForPTDay(2026, 8, 30)).toBe('Sunday, August 30th');
    expect(labelForPTDay(2026, 8, 24)).toBe('Monday, August 24th');
    expect(labelForPTDay(2026, 9, 6)).toBe('Sunday, September 6th');
  });

  it('uses st/nd/rd for 1, 2, 3', () => {
    expect(labelForPTDay(2026, 9, 1)).toBe('Tuesday, September 1st');
    expect(labelForPTDay(2026, 9, 2)).toBe('Wednesday, September 2nd');
    expect(labelForPTDay(2026, 9, 3)).toBe('Thursday, September 3rd');
  });

  it('uses th for 4-10', () => {
    expect(labelForPTDay(2026, 9, 4)).toBe('Friday, September 4th');
    expect(labelForPTDay(2026, 9, 10)).toBe('Thursday, September 10th');
  });

  it('uses th for the 11/12/13 irregulars (not st/nd/rd)', () => {
    expect(labelForPTDay(2026, 9, 11)).toBe('Friday, September 11th');
    expect(labelForPTDay(2026, 9, 12)).toBe('Saturday, September 12th');
    expect(labelForPTDay(2026, 9, 13)).toBe('Sunday, September 13th');
  });

  it('uses st/nd/rd for 21, 22, 23', () => {
    expect(labelForPTDay(2026, 8, 21)).toBe('Friday, August 21st');
    expect(labelForPTDay(2026, 8, 22)).toBe('Saturday, August 22nd');
    expect(labelForPTDay(2026, 8, 23)).toBe('Sunday, August 23rd');
  });

  it('uses th for end-of-month', () => {
    expect(labelForPTDay(2026, 8, 30)).toBe('Sunday, August 30th');
    expect(labelForPTDay(2026, 8, 31)).toBe('Monday, August 31st');
  });
});
