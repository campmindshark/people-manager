import ChorePlanSignupError from './chorePlanSignupError';
import {
  ChorePlanSignupRequest,
  ChorePlanSwitchRequest,
} from '../view_models/chore_plan_signup';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: string[],
): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}

export function parseChorePlanShiftID(value: unknown): number {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 1) {
    throw new ChorePlanSignupError('Choose a valid chore plan shift.', 400);
  }
  return Number(parsed);
}

function parseRequestShiftID(value: unknown): number {
  if (typeof value !== 'number') {
    throw new ChorePlanSignupError('Choose a valid chore plan shift.', 400);
  }
  return parseChorePlanShiftID(value);
}

export function parseEmptyChorePlanSignupRequest(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isObject(value) || Object.keys(value).length !== 0) {
    throw new ChorePlanSignupError(
      'Chore plan signup removal does not accept request details.',
      400,
    );
  }
}

export function parseChorePlanSignupRequest(
  value: unknown,
): ChorePlanSignupRequest {
  if (!isObject(value) || !exactKeys(value, ['shiftID'])) {
    throw new ChorePlanSignupError(
      'The signup request accepts only a shift ID.',
      400,
    );
  }
  return { shiftID: parseRequestShiftID(value.shiftID) };
}

export function parseChorePlanSwitchRequest(
  value: unknown,
): ChorePlanSwitchRequest {
  if (!isObject(value) || !exactKeys(value, ['fromShiftID', 'toShiftID'])) {
    throw new ChorePlanSignupError(
      'The switch request accepts only source and destination shift IDs.',
      400,
    );
  }
  const request = {
    fromShiftID: parseRequestShiftID(value.fromShiftID),
    toShiftID: parseRequestShiftID(value.toShiftID),
  };
  if (request.fromShiftID === request.toShiftID) {
    throw new ChorePlanSignupError(
      'Choose a different destination shift.',
      400,
    );
  }
  return request;
}
