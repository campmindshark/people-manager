import {
  effectiveRequirements,
  validateRequirements,
} from 'backend/utils/chorePlanRequirements';

test('validates configurable whole-number plan requirements', () => {
  expect(validateRequirements({ chore: 2, event: 1, dinner: 0 })).toEqual({
    chore: 2,
    event: 1,
    dinner: 0,
  });
  expect(() =>
    validateRequirements({ chore: -1, event: 1, dinner: 0 }),
  ).toThrow('Chore requirements must be a whole number');
  expect(() =>
    validateRequirements({ chore: 2.5, event: 1, dinner: 0 }),
  ).toThrow('Chore requirements must be a whole number');
});

test('keeps member exceptions at or below the plan defaults', () => {
  expect(
    effectiveRequirements(
      { chore: 2, event: 2, dinner: 1 },
      { chore: 1, event: 3, dinner: 0 },
    ),
  ).toEqual({ chore: 1, event: 2, dinner: 0 });
});
