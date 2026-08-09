import Knex, { Knex as KnexInstance } from 'knex';
import knexConfig from '../knexfile';
import GroupController, { ShiftSignupAccess } from './group';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import Schedule from '../models/schedule/schedule';
import ShiftViewModel from '../view_models/shift';
import { getConfig } from '../config/config';
import ShiftSignupError from '../utils/shiftSignupError';
import { shiftTimeRangesOverlap, ShiftTimeRange } from '../utils/shiftTime';
import { PUBLIC_SHIFT_COLUMNS } from '../utils/scheduleApiColumns';

const knex = Knex(knexConfig[getConfig().Environment]);

export interface ShiftSignupResult {
  registeredShiftIDs: number[];
}

interface ShiftSignupRow extends ShiftTimeRange {
  id: number;
  requiredParticipants: number;
  rosterID: number;
}

interface RosterParticipantAttendanceRow {
  rosterID: number;
  userID: number;
  estimatedArrivalDate: Date | string;
  estimatedDepartureDate: Date | string;
}

function shiftSignupAccessMessage(access: ShiftSignupAccess): string {
  return access.hasGroup
    ? 'Shift signup is not open for your priority group yet.'
    : 'You are not assigned to a shift signup group for this roster. Contact an administrator.';
}

async function requireShiftSignupAccess(
  userID: number,
  rosterID: number,
  database: KnexInstance,
): Promise<void> {
  const access = await GroupController.GetShiftSignupAccessForUser(
    userID,
    rosterID,
    database,
  );
  if (!access.signupOpen) {
    throw new ShiftSignupError(shiftSignupAccessMessage(access), 403);
  }
}

export default class ShiftController {
  public static async GetShiftsByParticipantIDandRoster(
    participantID: number,
    rosterID: number,
  ): Promise<Shift[]> {
    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', participantID)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
      .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
      .where('rosterID', rosterID)
      .select(...PUBLIC_SHIFT_COLUMNS);

    const shifts = await query;

    return shifts;
  }

  public static async GetShiftViewModelsByParticipantID(
    participantID: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', participantID)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
      .select(...PUBLIC_SHIFT_COLUMNS);

    const shifts = await query;

    const shiftViewModels =
      await ShiftController.loadViewModelsFromShifts(shifts);
    return shiftViewModels;
  }

  public static async GetShiftViewModelsByScheduleID(
    scheduleID: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .select(...PUBLIC_SHIFT_COLUMNS)
      .where('scheduleID', scheduleID)
      .orderBy('startTime', 'asc');

    const shifts = await query;

    const shiftViewModels =
      await ShiftController.loadViewModelsFromShifts(shifts);
    return shiftViewModels;
  }

  public static async UnregisterParticipantFromShift(
    shiftID: number,
    userID: number,
    database: KnexInstance = knex,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(shiftID) ||
      shiftID < 1 ||
      !Number.isSafeInteger(userID) ||
      userID < 1
    ) {
      throw new ShiftSignupError('Choose a valid shift.', 400);
    }

    const query = database('shift_participants')
      .where('shiftID', shiftID)
      .andWhere('userID', userID)
      .del();

    await query;

    return true;
  }

  public static async RegisterParticipantForShift(
    shiftID: number,
    userID: number,
    database: KnexInstance = knex,
  ): Promise<ShiftSignupResult> {
    if (
      !Number.isSafeInteger(shiftID) ||
      shiftID < 1 ||
      !Number.isSafeInteger(userID) ||
      userID < 1
    ) {
      throw new ShiftSignupError('Choose a valid shift.', 400);
    }

    return database.transaction(async (transaction) => {
      const user = await transaction('users')
        .select('id')
        .where('id', userID)
        .forUpdate()
        .first();
      if (!user) {
        throw new ShiftSignupError('User not found.', 404);
      }

      const shift = await transaction<ShiftSignupRow>('shifts')
        .join('schedules', 'shifts.scheduleID', '=', 'schedules.id')
        .select(
          'shifts.id',
          'shifts.requiredParticipants',
          'shifts.startTime',
          'shifts.endTime',
          'schedules.rosterID',
        )
        .where('shifts.id', shiftID)
        .forUpdate('shifts')
        .first();
      if (!shift) {
        throw new ShiftSignupError('Shift not found.', 404);
      }

      await requireShiftSignupAccess(userID, shift.rosterID, transaction);

      const participant = (await transaction<RosterParticipantAttendanceRow>(
        'roster_participants',
      )
        .select('estimatedArrivalDate', 'estimatedDepartureDate')
        .where({ rosterID: shift.rosterID, userID })
        .forUpdate()
        .first()) as RosterParticipantAttendanceRow | undefined;
      if (!participant) {
        throw new ShiftSignupError(
          'Shift signup is available only to roster members.',
          403,
        );
      }

      const shiftStart = new Date(shift.startTime).getTime();
      const shiftEnd = new Date(shift.endTime).getTime();
      const arrival = new Date(participant.estimatedArrivalDate).getTime();
      const departure = new Date(participant.estimatedDepartureDate).getTime();
      if (shiftStart < arrival || shiftEnd > departure) {
        throw new ShiftSignupError(
          'This shift is outside your roster attendance window.',
          409,
        );
      }

      const existingSignup = await transaction('shift_participants')
        .where({ shiftID, userID })
        .first();
      if (existingSignup) {
        return { registeredShiftIDs: [] };
      }

      const existingShifts = await transaction<ShiftTimeRange>(
        'shift_participants',
      )
        .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id')
        .select('shifts.startTime', 'shifts.endTime')
        .where('shift_participants.userID', userID);
      if (
        existingShifts.some((existingShift) =>
          shiftTimeRangesOverlap(shift, existingShift),
        )
      ) {
        throw new ShiftSignupError(
          'You are already signed up for another shift during this time block.',
          409,
        );
      }

      const participantCount = await transaction('shift_participants')
        .where('shiftID', shiftID)
        .count('* as count')
        .first();
      if (
        Number(participantCount?.count ?? 0) >=
        Number(shift.requiredParticipants)
      ) {
        throw new ShiftSignupError('This shift is already full.', 409);
      }

      await transaction('shift_participants').insert({ shiftID, userID });
      return { registeredShiftIDs: [shiftID] };
    });
  }

  private static async loadViewModelsFromShifts(
    shifts: Shift[],
  ): Promise<ShiftViewModel[]> {
    const shiftViewModels: Promise<ShiftViewModel>[] = shifts.map(
      async (shift): Promise<ShiftViewModel> => {
        const [participants, schedule] = await Promise.all([
          Shift.relatedQuery('participants').for(shift.id),
          Schedule.query().findById(shift.scheduleID),
        ]);

        if (!schedule) {
          throw new Error('Schedule not found for shift');
        }

        return {
          shift,
          scheduleName: Schedule.fromJson(schedule).name,
          participants: participants.map((participant) =>
            User.fromJson(participant),
          ),
        };
      },
    );

    const shiftViewModelsResolved = await Promise.all(shiftViewModels);
    return shiftViewModelsResolved;
  }
}
