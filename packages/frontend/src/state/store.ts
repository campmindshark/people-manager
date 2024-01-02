import { atom, selector } from 'recoil';
import User from 'backend/models/user/user';
import { getConfig } from 'backend/config/config';
import { RoleConfig } from 'backend/roles/role';
import ShiftViewModel from 'backend/view_models/shift';
import BackendUserClient from '../api/users/client';
import BackendShiftClient from '../api/shifts/shifts';
import BackendRoleClient from '../api/roles/client';
import { CurrentRosterParticipantsState } from './roster';

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

export const MyShifts = selector<ShiftViewModel[]>({
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

export const MyRolesState = selector<RoleConfig[]>({
  key: 'myRoles',
  get: async ({ get }) => {
    const thisUser = get(UserState);
    if (thisUser) {
      const shiftClient = new BackendRoleClient(config.BackendURL);
      const roles = await shiftClient.GetMyRoles();

      return roles;
    }
    return [];
  },
});

export const UserIsSignedUpForCurrentRoster = selector<boolean>({
  key: 'userIsSignedUpForCurrentRoster',
  get: async ({ get }) => {
    const thisUser = get(UserState);
    const currentRosterParticipants = get(CurrentRosterParticipantsState);

    if (thisUser && currentRosterParticipants) {
      return currentRosterParticipants.some(
        (participant) => participant.id === thisUser.id,
      );
    }

    return false;
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
