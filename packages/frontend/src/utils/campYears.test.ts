import {
  FIRST_MINDSHARK_YEAR,
  assertYearsAtCampWithinRoster,
  getCampYearsOptions,
} from 'backend/utils/campYears';

describe('getCampYearsOptions', () => {
  it('returns an empty list before any prior year exists', () => {
    expect(getCampYearsOptions(FIRST_MINDSHARK_YEAR)).toEqual([]);
  });

  it('returns an empty list for non-integer roster years', () => {
    expect(getCampYearsOptions(Number.NaN)).toEqual([]);
    expect(getCampYearsOptions(2026.5)).toEqual([]);
  });

  it('excludes the current roster year (event has not happened yet)', () => {
    expect(getCampYearsOptions(2025)).not.toContain(2025);
  });

  it('includes the immediately prior year', () => {
    expect(getCampYearsOptions(2026)).toContain(2025);
  });

  it('excludes years where camp did not operate', () => {
    expect(getCampYearsOptions(2026)).not.toContain(2020);
  });

  it('keeps the lower bound at the first MindShark year', () => {
    expect(getCampYearsOptions(2026)[0]).toBe(FIRST_MINDSHARK_YEAR);
  });
});

// Static checks (type, integer, lower bound, exclude 2020, uniqueItems) are
// enforced by Objection's jsonSchema on save and are not duplicated here.
// These tests only cover the dynamic upper bound that jsonSchema cannot
// express.
describe('assertYearsAtCampWithinRoster', () => {
  it('accepts undefined as no-op', () => {
    expect(assertYearsAtCampWithinRoster(undefined, 2026)).toEqual({
      valid: true,
    });
  });

  it('accepts an empty array', () => {
    expect(assertYearsAtCampWithinRoster([], 2026)).toEqual({ valid: true });
  });

  it('accepts years strictly before the roster year', () => {
    expect(assertYearsAtCampWithinRoster([2024, 2025], 2026)).toEqual({
      valid: true,
    });
  });

  it('rejects the current roster year (event has not happened yet)', () => {
    const result = assertYearsAtCampWithinRoster([2026], 2026);
    expect(result.valid).toBe(false);
  });

  it('rejects years beyond the roster year', () => {
    const result = assertYearsAtCampWithinRoster([2999], 2026);
    expect(result.valid).toBe(false);
  });

  it('regression: 2025 rejected on a 2025 roster, accepted on a 2026 roster', () => {
    expect(assertYearsAtCampWithinRoster([2025], 2025).valid).toBe(false);
    expect(assertYearsAtCampWithinRoster([2025], 2026).valid).toBe(true);
  });

  it('ignores non-array input (jsonSchema rejects it on save)', () => {
    expect(assertYearsAtCampWithinRoster('2025' as unknown, 2026)).toEqual({
      valid: true,
    });
  });
});
