import axios from 'axios';
import User from 'react-backend/user/user';

export interface UserClient {
  GetAllUsers(): Promise<User[]>
}

export default class BackendUserClient implements UserClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllUsers(): Promise<User[]> {
    const { data } = await axios.get<User[]>(`${this.baseApiURL}/users`, {
      headers: {
        Accept: 'application/json',
      },
    });
    return data;
  }
}
