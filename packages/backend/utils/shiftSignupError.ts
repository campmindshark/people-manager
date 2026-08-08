export default class ShiftSignupError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function parseShiftID(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ShiftSignupError('Choose a valid shift.', 400);
  }

  const shiftID = Number(value);
  if (!Number.isSafeInteger(shiftID)) {
    throw new ShiftSignupError('Choose a valid shift.', 400);
  }

  return shiftID;
}
