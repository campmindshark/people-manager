import { atom, selector } from 'recoil';
import User from 'backend/models/user/user';
import { RoleConfig } from 'backend/roles/role';
import ShiftViewModel from 'backend/view_models/shift';
import SignupStatus, {
  NewPlaceholderSignupStatus,
} from 'backend/view_models/signup_status';
import { getFrontendConfig } from '../config/config';
import BackendUserClient from '../api/users/client';
import BackendShiftClient from '../api/shifts/shifts';
import BackendRoleClient from '../api/roles/client';
import { CurrentRosterState } from './roster';

const frontendConfig = getFrontendConfig();

export const UsersState = selector<User[]>({
  key: 'users',
  get: async () => {
    const apiMethod = new BackendUserClient(frontendConfig.BackendURL);
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
    if (!thisUser) {
      return [];
    }

    const shiftClient = new BackendShiftClient(frontendConfig.BackendURL);
    const shifts = await shiftClient.GetMyShifts();

    return shifts;
  },
});

export const MyRolesState = selector<RoleConfig[]>({
  key: 'myRoles',
  get: async ({ get }) => {
    const thisUser = get(UserState);
    if (!thisUser) {
      return [];
    }

    const shiftClient = new BackendRoleClient(frontendConfig.BackendURL);
    const roles = await shiftClient.GetMyRoles();

    return roles;
  },
});

export const CurrentUserSignupStatus = selector<SignupStatus>({
  key: 'currentUserSignupStatus',
  get: async ({ get }) => {
    const userClient = new BackendUserClient(frontendConfig.BackendURL);
    const tmp: SignupStatus = NewPlaceholderSignupStatus();

    const thisUser = get(UserState);
    if (!thisUser) {
      return tmp;
    }

    const rosterState = get(CurrentRosterState);
    if (!rosterState) {
      return tmp;
    }

    const signupStatus = await userClient.GetUserSignupStatus(
      thisUser.id,
      rosterState.id,
    );

    return signupStatus;
  },
});

export const CurrentUserIsVerified = selector<boolean>({
  key: 'currentUserIsVerified',
  get: async () => {
    const userClient = new BackendUserClient(frontendConfig.BackendURL);

    const isVerified = await userClient.IsUserVerified();

    return isVerified;
  },
});

export const UserIsSignedUpForCurrentRoster = selector<boolean>({
  key: 'userIsSignedUpForCurrentRoster',
  get: async ({ get }) => {
    const thisUser = get(UserState);
    const currentRosterStatus = get(CurrentUserSignupStatus);

    if (!thisUser) {
      return false;
    }

    return currentRosterStatus.hasSignedUpForRoster;
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
