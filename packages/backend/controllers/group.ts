import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import Group from '../models/group/group';
import GroupViewModel from '../view_models/group';
import User from '../models/user/user';
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
}
