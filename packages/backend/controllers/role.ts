import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import RoleConfigCollection, { RoleConfig } from '../roles/role';

const knex = Knex(knexConfig[getConfig().Environment]);

export default class RoleController {
  public static async getRolesByUserID(userId: number): Promise<RoleConfig[]> {
    const query = knex<RoleConfig>('roles')
      .from('user_roles')
      .where('userID', userId);

    const roles = await query;

    const roleConfigs = roles.map((role) =>
      RoleConfigCollection.getRoleByID(role.roleID),
    );

    return roleConfigs;
  }

  public static async getUsersByRoleID(roleID: number): Promise<RoleConfig[]> {
    const query = knex<RoleConfig>('roles')
      .from('user_roles')
      .where('roleID', roleID);

    const roles = await query;

    const roleConfigs = roles.map((role) =>
      RoleConfigCollection.getRoleByID(role.roleID),
    );

    return roleConfigs;
  }
}
