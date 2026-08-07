export interface RosterParticipantBulkRemovalInput {
  rosterID: number;
  userIDs: number[];
}

function parsePathID(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseRosterParticipantBulkRemovalInput(
  rosterIDValue: unknown,
  userIDsValue: unknown,
): RosterParticipantBulkRemovalInput | null {
  const rosterID = parsePathID(rosterIDValue);
  if (
    rosterID === null ||
    !Array.isArray(userIDsValue) ||
    userIDsValue.length === 0 ||
    !userIDsValue.every(
      (userID) => Number.isSafeInteger(userID) && Number(userID) > 0,
    )
  ) {
    return null;
  }

  return {
    rosterID,
    userIDs: userIDsValue.map((userID) => Number(userID)),
  };
}
