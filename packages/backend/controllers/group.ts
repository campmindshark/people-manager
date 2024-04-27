import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import Group from '../models/group/group';
import GroupViewModel from '../view_models/group';
import User from '../models/user/user';
import { DateTime } from 'luxon';
import RoleConfigCollection, { RoleConfig } from '../roles/role';

const knex = Knex(knexConfig[getConfig().Environment]);

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
    user: User,
    rosterID: number,
  ): Promise<boolean> {
    const groups = await GroupController.GetAllGroupsForUser(user);

    if (groups.length === 0) {
      return false;
    }

    groups.filter((group) => group.rosterID === rosterID);

    groups.sort(
      (a, b) =>
        a.shiftSignupOpenDate.getTime() - b.shiftSignupOpenDate.getTime(),
    );

    console.log('groups', groups);

    console.log(
      'Earliest signup date UTC',
      DateTime.fromJSDate(groups[0].shiftSignupOpenDate)
        .setZone('utc', { keepLocalTime: true })
        .toISO(),
    );

    console.log('Current date UTC', DateTime.utc().toISO());

    if (
      DateTime.fromJSDate(groups[0].shiftSignupOpenDate).setZone('utc', {
        keepLocalTime: true,
      }) > DateTime.utc()
    ) {
      return false;
    }

    return true;
  }
}
