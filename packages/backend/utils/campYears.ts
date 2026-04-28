export const FIRST_MINDSHARK_YEAR = 2013;

const EXCLUDED_CAMP_YEARS: ReadonlySet<number> = new Set([2020]);

export const getCampYearsOptions = (rosterYear: number): number[] => {
  if (!Number.isInteger(rosterYear)) {
    return [];
  }

  const lastCampYear = rosterYear - 1;

  if (lastCampYear < FIRST_MINDSHARK_YEAR) {
    return [];
  }

  return Array.from(
    { length: lastCampYear - FIRST_MINDSHARK_YEAR + 1 },
    (_, index) => FIRST_MINDSHARK_YEAR + index,
  ).filter((year) => !EXCLUDED_CAMP_YEARS.has(year));
};

// Dynamic check that jsonSchema cannot express: yearsAtCamp must not include
// the current burn year or anything later, since the event has not happened
// yet. Static checks (type, integer, lower bound, exclude 2020, uniqueness)
// are enforced by Objection's jsonSchema on save.
export const assertYearsAtCampWithinRoster = (
  yearsAtCamp: unknown,
  rosterYear: number,
): { valid: true } | { valid: false; error: string } => {
  if (!Array.isArray(yearsAtCamp)) {
    return { valid: true };
  }

  const lastAllowedYear = rosterYear - 1;

  for (let i = 0; i < yearsAtCamp.length; i += 1) {
    const candidate = yearsAtCamp[i];

    if (typeof candidate === 'number' && candidate > lastAllowedYear) {
      return {
        valid: false,
        error: `yearsAtCamp contains ${candidate}; must be <= ${lastAllowedYear}`,
      };
    }
  }

  return { valid: true };
};
