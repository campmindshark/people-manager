import Knex, { Knex as KnexInstance } from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import Group from '../models/group/group';
import GroupViewModel from '../view_models/group';
import User from '../models/user/user';

const knex = Knex(knexConfig[getConfig().Environment]);

export interface ShiftSignupAccess {
  hasGroup: boolean;
  signupOpen: boolean;
}

interface ShiftSignupAccessRow {
  signupOpen: boolean;
}

export default class GroupController {
  public static async GetGroupViewModels(
    groups: Group[],
  ): Promise<GroupViewModel[]> {
    const groupViewModels: Promise<GroupViewModel>[] = groups.map(
      async (group): Promise<GroupViewModel> => {
        const members = await Group.relatedQuery('members').for(group.id);
        if (!members) {
          return {
            group,
            members: [],
          };
        }

        return {
          group,
          members: members.map((member) => User.fromJson(member)),
        };
      },
    );

    const viewModels: GroupViewModel[] = await Promise.all(groupViewModels);

    return viewModels;
  }

  public static async GetAllGroupsForUser(user: User): Promise<Group[]> {
    const groups = await knex<Group>('groups')
      .from('group_members')
      .where({
        userID: user.id,
      })
      .join('groups', 'group_members.groupID', '=', 'groups.id');

    return groups;
  }

  public static async UserCanSignupForShifts(
    user: User | number,
    rosterID: number,
    database: KnexInstance = knex,
  ): Promise<boolean> {
    const access = await GroupController.GetShiftSignupAccessForUser(
      typeof user === 'number' ? user : user.id,
      rosterID,
      database,
    );
    return access.signupOpen;
  }

  public static async GetShiftSignupAccessForUser(
    userID: number,
    rosterID: number,
    database: KnexInstance = knex,
  ): Promise<ShiftSignupAccess> {
    // This legacy column stores UTC wall-clock values without timezone metadata.
    const group: ShiftSignupAccessRow | undefined = await database(
      'group_members',
    )
      .join('groups', 'group_members.groupID', '=', 'groups.id')
      .select(
        database.raw("?? <= timezone('UTC', CURRENT_TIMESTAMP) AS ??", [
          'groups.shiftSignupOpenDate',
          'signupOpen',
        ]),
      )
      .where('group_members.userID', userID)
      .andWhere('groups.rosterID', rosterID)
      .orderBy('groups.shiftSignupOpenDate', 'asc')
      .first();

    return {
      hasGroup: Boolean(group),
      signupOpen: group?.signupOpen === true,
    };
  }
}
