import axios from 'axios';
import User from 'backend/models/user/user';
import PrivateProfile from 'backend/models/user/user_private';
import SignupStatus from 'backend/view_models/signup_status';
import defaultRequestConfig from '../common/requestConfig';

export interface AuthResponse {
  user: User;
  success: boolean;
  message: string;
}

export interface UserClient {
  GetAllUsers(): Promise<User[]>;
  GetAuthenticatedUser(): Promise<AuthResponse>;
  GetUserSignupStatus(userID: number, rosterID: number): Promise<SignupStatus>;
  IsUserVerified(): Promise<boolean>;
}

export default class BackendUserClient implements UserClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllUsers(): Promise<User[]> {
    const { data } = await axios.get<User[]>(
      `${this.baseApiURL}/api/users`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetAuthenticatedUser(): Promise<AuthResponse> {
    const { data } = await axios.get<AuthResponse>(
      `${this.baseApiURL}/api/auth/login/success`,
      defaultRequestConfig,
    );

    return data;
  }

  async UpdateUser(user: User): Promise<User> {
    const { data } = await axios.post<User>(
      `${this.baseApiURL}/api/users`,
      user,
      defaultRequestConfig,
    );

    return data;
  }

  async GetMyPrivateProfile(): Promise<PrivateProfile> {
    const { data } = await axios.get<PrivateProfile>(
      `${this.baseApiURL}/api/users/private/my-private-profile`,
      defaultRequestConfig,
    );

    return data;
  }

  async UpdatePrivateProfile(
    privateProfile: PrivateProfile,
  ): Promise<PrivateProfile> {
    const { data } = await axios.post<PrivateProfile>(
      `${this.baseApiURL}/api/users/private`,
      privateProfile,
      defaultRequestConfig,
    );

    return data;
  }

  async GetUserSignupStatus(
    userID: number,
    rosterID: number,
  ): Promise<SignupStatus> {
    const { data } = await axios.get<SignupStatus>(
      `${this.baseApiURL}/api/users/${userID}/signup-status/${rosterID}`,
      defaultRequestConfig,
    );

    return data;
  }

  async GetMySignupStatus(rosterID: number): Promise<SignupStatus> {
    const { data } = await axios.get<SignupStatus>(
      `${this.baseApiURL}/api/users/signup-status/${rosterID}`,
      defaultRequestConfig,
    );

    return data;
  }

  async IsUserVerified(): Promise<boolean> {
    const { data } = await axios.get<boolean>(
      `${this.baseApiURL}/api/users/is-verified`,
      defaultRequestConfig,
    );

    return data;
  }

  async GetAllUnverifiedUsers(): Promise<User[]> {
    try {
      const { data } = await axios.get<User[]>(
        `${this.baseApiURL}/api/users/unverified`,
        defaultRequestConfig,
      );

      return data;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async VerifyUser(userID: number): Promise<User> {
    const { data } = await axios.post<User>(
      `${this.baseApiURL}/api/users/verify/${userID}`,
      {},
      defaultRequestConfig,
    );

    return data;
  }

  async UserCanSignupForShifts(rosterID: number): Promise<boolean> {
    const { data } = await axios.get<boolean>(
      `${this.baseApiURL}/api/users/can-signup-for-shifts/${rosterID}`,
      defaultRequestConfig,
    );

    return data;
  }

  async BlockUser(
    userID: number,
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await axios.post<{ success: boolean; message: string }>(
      `${this.baseApiURL}/api/users/block/${userID}`,
      {},
      defaultRequestConfig,
    );

    return data;
  }

  async UnBlockUser(
    userID: number,
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await axios.post<{ success: boolean; message: string }>(
      `${this.baseApiURL}/api/users/unblock/${userID}`,
      {},
      defaultRequestConfig,
    );

    return data;
  }
}
