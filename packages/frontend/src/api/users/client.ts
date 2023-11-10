import axios from 'axios';
import User from 'backend/models/user/user';

export interface UserClient {
  GetAllUsers(): Promise<User[]>;
}

export default class BackendUserClient implements UserClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllUsers(): Promise<User[]> {
    const { data } = await axios.get<User[]>(`${this.baseApiURL}/api/users`, {
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
    return data;
  }

  async GetAuthenticatedUser(): Promise<User> {
    const { data } = await axios.get<User>(
      `${this.baseApiURL}/api/auth/login/success`,
      {
        withCredentials: true,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      },
    );

    console.log(data);
    return data;
  }
}
