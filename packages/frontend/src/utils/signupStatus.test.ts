import {
  NewPlaceholderSignupStatus,
  signupStatusIssues,
} from 'backend/view_models/signup_status';
import { ChorePlanRequirements } from 'backend/view_models/chore_plan';

const choreSignupIssues = (
  choreShiftCount: number,
  eventShiftCount: number,
  dinnerShiftCount: number,
  choreSignupsOpen = true,
  requirements?: ChorePlanRequirements,
) => {
  const status = NewPlaceholderSignupStatus();
  status.hasSignedUpForRoster = true;
  status.choreSignupsOpen = choreSignupsOpen;
  status.choreShiftCount = choreShiftCount;
  status.eventShiftCount = eventShiftCount;
  status.dinnerShiftCount = dinnerShiftCount;
  if (requirements) {
    status.requirements = requirements;
  }
  return signupStatusIssues(status).filter((issue) =>
    issue.startsWith('Chore signups are open.'),
  );
};

test('does not show shift requirements while chore signups are closed', () => {
  expect(choreSignupIssues(0, 0, 0, false)).toEqual([]);
});

test('shows the full 3/3/1 requirement when signups open', () => {
  expect(choreSignupIssues(0, 0, 0)).toEqual([
    'Chore signups are open. You still need to sign up for 3 chore shifts, 3 event shifts, and 1 dinner shift.',
  ]);
});

test('shows only the remaining shifts for incomplete categories', () => {
  expect(choreSignupIssues(2, 3, 0)).toEqual([
    'Chore signups are open. You still need to sign up for 1 chore shift and 1 dinner shift.',
  ]);
});

test('clears the notice once all category requirements are met', () => {
  expect(choreSignupIssues(3, 4, 1)).toEqual([]);
});

test('uses reduced member requirements and ignores exempt categories', () => {
  expect(
    choreSignupIssues(0, 0, 0, true, {
      chore: 1,
      event: 0,
      dinner: 0,
    }),
  ).toEqual([
    'Chore signups are open. You still need to sign up for 1 chore shift.',
  ]);
});
