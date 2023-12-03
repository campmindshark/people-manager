import { atom, selector } from 'recoil';
import User from 'backend/models/user/user';
import { getConfig } from 'backend/config/config';
import BackendUserClient from '../api/users/client';
import BackendShiftClient from '../api/shifts/shifts';

const config = getConfig();

export const UsersState = selector<User[]>({
  key: 'users',
  get: async () => {
    const apiMethod = new BackendUserClient(config.BackendURL);
    const users = await apiMethod.GetAllUsers();

    return users;
  },
});

export const UserState = atom<User>({
  key: 'userState',
  default: new User(),
});

export const MyShifts = selector({
  key: 'myShifts',
  get: async ({ get }) => {
    const thisUser = get(UserState);
    if (thisUser) {
      const shiftClient = new BackendShiftClient(config.BackendURL);
      const shifts = await shiftClient.GetShiftsByParticipantID(thisUser.id);

      return shifts;
    }
    return [];
  },
});

export const UserIsAuthenticated = atom<boolean>({
  key: 'userIsAuthenticated',
  default: false,
});

interface PageData {
  title: string;
  index: string;
}

const PageState = atom<PageData>({
  key: 'pageState',
  default: {
    title: 'Home',
    index: 'home',
  },
});

export default PageState;
