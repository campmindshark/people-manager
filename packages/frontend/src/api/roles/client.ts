import axios from 'axios';
import User from 'backend/models/user/user';
import { RoleConfig } from 'backend/roles/role';

export interface AuthResponse {
  user: User;
  success: boolean;
  message: string;
}

export interface RoleClient {
  GetMyRoles(): Promise<RoleConfig[]>;
}

export default class BackendRoleClient implements RoleClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetMyRoles(): Promise<RoleConfig[]> {
    const { data } = await axios.get<RoleConfig[]>(
      `${this.baseApiURL}/api/roles/my_roles`,
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );
    return data;
  }
}
