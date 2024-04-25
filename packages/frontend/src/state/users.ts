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

const UnverifiedUserState = selector<User[]>({
  key: 'unverifiedUsers',
  get: async () => {
    const apiMethod = new BackendUserClient(frontendConfig.BackendURL);
    const users = await apiMethod.GetAllUnverifiedUsers();

    return users;
  },
});

export default UnverifiedUserState;
