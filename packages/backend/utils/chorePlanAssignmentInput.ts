import ChorePlanAssignmentError from './chorePlanAssignmentError';
import {
  ChorePlanAdminAssignmentMutation,
  ChorePlanForceAssignmentRequest,
} from '../view_models/chore_plan_assignments';

export const MAX_CHORE_PLAN_FORCE_REASON_LENGTH = 500;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function positiveID(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new ChorePlanAssignmentError(
      'Choose valid participants and chore plan shifts.',
      400,
    );
  }
  return Number(value);
}

export function parseChorePlanAdminAssignmentMutation(
  value: unknown,
): ChorePlanAdminAssignmentMutation {
  if (!isObject(value) || typeof value.operation !== 'string') {
    throw new ChorePlanAssignmentError(
      'Choose a valid administrative assignment operation.',
      400,
    );
  }

  if (
    (value.operation === 'assign' || value.operation === 'unassign') &&
    hasExactKeys(value, ['operation', 'userID', 'shiftID'])
  ) {
    return {
      operation: value.operation,
      userID: positiveID(value.userID),
      shiftID: positiveID(value.shiftID),
    };
  }
  if (
    value.operation === 'move' &&
    hasExactKeys(value, ['operation', 'userID', 'fromShiftID', 'toShiftID'])
  ) {
    const mutation: ChorePlanAdminAssignmentMutation = {
      operation: 'move',
      userID: positiveID(value.userID),
      fromShiftID: positiveID(value.fromShiftID),
      toShiftID: positiveID(value.toShiftID),
    };
    if (mutation.fromShiftID === mutation.toShiftID) {
      throw new ChorePlanAssignmentError(
        'Choose a different destination shift.',
        400,
      );
    }
    return mutation;
  }
  if (
    value.operation === 'swap' &&
    hasExactKeys(value, [
      'operation',
      'firstUserID',
      'firstShiftID',
      'secondUserID',
      'secondShiftID',
    ])
  ) {
    const mutation: ChorePlanAdminAssignmentMutation = {
      operation: 'swap',
      firstUserID: positiveID(value.firstUserID),
      firstShiftID: positiveID(value.firstShiftID),
      secondUserID: positiveID(value.secondUserID),
      secondShiftID: positiveID(value.secondShiftID),
    };
    if (
      mutation.firstUserID === mutation.secondUserID ||
      mutation.firstShiftID === mutation.secondShiftID
    ) {
      throw new ChorePlanAssignmentError(
        'A swap requires two different participants and shifts.',
        400,
      );
    }
    return mutation;
  }

  throw new ChorePlanAssignmentError(
    'The administrative assignment request has unexpected fields.',
    400,
  );
}

export function parseChorePlanForceAssignmentRequest(
  value: unknown,
): ChorePlanForceAssignmentRequest {
  if (!isObject(value) || !hasExactKeys(value, ['mutation', 'reason'])) {
    throw new ChorePlanAssignmentError(
      'A forced assignment request accepts only a mutation and reason.',
      400,
    );
  }
  if (typeof value.reason !== 'string') {
    throw new ChorePlanAssignmentError('Enter a valid force reason.', 400);
  }
  const reason = value.reason.trim();
  if (
    reason.length === 0 ||
    reason.length > MAX_CHORE_PLAN_FORCE_REASON_LENGTH
  ) {
    throw new ChorePlanAssignmentError(
      `Force reason must be from 1 through ${MAX_CHORE_PLAN_FORCE_REASON_LENGTH} characters.`,
      400,
    );
  }
  const mutation = parseChorePlanAdminAssignmentMutation(value.mutation);
  if (mutation.operation === 'unassign') {
    throw new ChorePlanAssignmentError(
      'Unassignment never requires a force override.',
      400,
    );
  }
  return { mutation, reason };
}
