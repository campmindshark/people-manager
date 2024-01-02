import Config from './config.json';

export interface RoleConfig {
  id: number;
  name: string;
  permissions: string[];
}

export default class RoleConfigCollection {
  private static roles: RoleConfig[] = Config.roles;

  static getRoleByName(name: string): RoleConfig {
    const role = this.roles.find((r) => r.name === name);
    if (!role) {
      throw new Error(`Role ${name} does not exist`);
    }
    return role;
  }

  static getRoleByID(id: number): RoleConfig {
    const role = this.roles.find((r) => r.id === id);
    if (!role) {
      throw new Error(`Role ${id} does not exist`);
    }
    return role;
  }

  static getRoles(): RoleConfig[] {
    return this.roles;
  }

  static getPermissions(): string[] {
    return this.roles.flatMap((role) => role.permissions);
  }

  static hasPermission(roleIDs: number[], permission: string): boolean {
    console.log(`Checking if roleIDs ${roleIDs} have permission ${permission}`);
    const roles = roleIDs.map((id) => this.getRoleByID(id));
    const permissions = roles.flatMap((role) => role.permissions);
    return permissions.includes(permission);
  }
}
