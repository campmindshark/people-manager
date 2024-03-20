import axios from 'axios';
import User from 'backend/models/user/user';
import PrivateProfile from 'backend/models/user/user_private';
import SignupStatus from 'backend/view_models/signup_status';

export interface AuthResponse {
  user: User;
  success: boolean;
  message: string;
}

export interface UserClient {
  GetAllUsers(): Promise<User[]>;
  GetAuthenticatedUser(): Promise<AuthResponse>;
  GetUserSignupStatus(userID: number, rosterID: number): Promise<SignupStatus>;
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

  async GetAuthenticatedUser(): Promise<AuthResponse> {
    const { data } = await axios.get<AuthResponse>(
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

    return data;
  }

  async UpdateUser(user: User): Promise<User> {
    const { data } = await axios.post<User>(
      `${this.baseApiURL}/api/users`,
      user,
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

  async GetMyPrivateProfile(): Promise<PrivateProfile> {
    const { data } = await axios.get<PrivateProfile>(
      `${this.baseApiURL}/api/users/private`,
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

  async UpdatePrivateProfile(
    privateProfile: PrivateProfile,
  ): Promise<PrivateProfile> {
    const { data } = await axios.post<PrivateProfile>(
      `${this.baseApiURL}/api/users/private`,
      privateProfile,
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

  async GetUserSignupStatus(
    userID: number,
    rosterID: number,
  ): Promise<SignupStatus> {
    const { data } = await axios.get<SignupStatus>(
      `${this.baseApiURL}/api/users/${userID}/signup-status/${rosterID}`,
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
