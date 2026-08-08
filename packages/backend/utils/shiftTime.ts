export interface ShiftTimeRange {
  startTime: Date | string;
  endTime: Date | string;
}

export function shiftTimeRangesOverlap(
  first: ShiftTimeRange,
  second: ShiftTimeRange,
): boolean {
  const firstStart = new Date(first.startTime).getTime();
  const firstEnd = new Date(first.endTime).getTime();
  const secondStart = new Date(second.startTime).getTime();
  const secondEnd = new Date(second.endTime).getTime();

  if (
    !Number.isFinite(firstStart) ||
    !Number.isFinite(firstEnd) ||
    !Number.isFinite(secondStart) ||
    !Number.isFinite(secondEnd) ||
    firstStart >= firstEnd ||
    secondStart >= secondEnd
  ) {
    throw new Error('Shift time ranges must have valid start and end times.');
  }

  return firstStart < secondEnd && secondStart < firstEnd;
}
