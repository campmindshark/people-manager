import Knex from 'knex';
import knexConfig from '../knexfile';
import Shift from '../models/shift/shift';
import User from '../models/user/user';
import Schedule from '../models/schedule/schedule';
import ShiftViewModel from '../view_models/shift';
import { getConfig } from '../config/config';

const knex = Knex(knexConfig[getConfig().Environment]);

export default class ShiftController {
  // Path: packages/backend/controllers/shift.ts
  public static async GetShiftViewModelsByParticipantID(
    participantID: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .from('shift_participants')
      .where('userID', participantID)
      .join('shifts', 'shift_participants.shiftID', '=', 'shifts.id');

    const shifts = await query;

    const shiftViewModels =
      await ShiftController.loadViewModelsFromShifts(shifts);
    return shiftViewModels;
  }

  public static async GetShiftViewModelsByScheduleID(
    scheduleID: number,
  ): Promise<ShiftViewModel[]> {
    const query = knex<Shift>('shifts')
      .where('scheduleID', scheduleID)
      .orderBy('startTime', 'asc');

    const shifts = await query;

    const shiftViewModels =
      await ShiftController.loadViewModelsFromShifts(shifts);
    return shiftViewModels;
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
