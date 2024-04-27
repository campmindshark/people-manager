import { selector } from 'recoil';
import User from 'backend/models/user/user';
import { getFrontendConfig } from '../config/config';
import BackendUserClient from '../api/users/client';

const frontendConfig = getFrontendConfig();

export const AllUsers = selector<User[]>({
  key: 'allUsers',
  get: async () => {
    const apiMethod = new BackendUserClient(frontendConfig.BackendURL);
    const users = await apiMethod.GetAllUsers();

    return users;
  },
});

export const UserCanSignupForShifts = selector<boolean>({
  key: 'userCanSignupForShifts',
  get: async () => {
    const apiMethod = new BackendUserClient(
      frontendConfig.BackendURL,
    ).UserCanSignupForShifts(1);
    const canSignup = await apiMethod;

    return canSignup;
  },
});

const UnverifiedUserState = selector<User[]>({
  key: 'unverifiedUsers',
  get: async () => {
    const apiMethod = new BackendUserClient(frontendConfig.BackendURL);
    const users = await apiMethod.GetAllUnverifiedUsers();

    return users;
  },
});

export default UnverifiedUserState;
