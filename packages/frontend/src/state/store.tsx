import { atom, selector } from "recoil";
import User from "backend/user/user";
import { getConfig } from "backend/config/config";
import BackendUserClient from "../api/users/client";

const config = getConfig();

export const UsersState = selector<User[]>({
  key: "users",
  get: async () => {
    const apiMethod = new BackendUserClient(config.BackendURL);
    const users = await apiMethod.GetAllUsers();

    return users;
  },
});

export const UserState = atom<User>({
  key: "userState",
  default: new User(),
});

export const UserIsAuthenticated = atom<boolean>({
  key: "userIsAuthenticated",
  default: false,
});

interface PageData {
  title: string;
  index: string;
}

const PageState = atom<PageData>({
  key: "pageState",
  default: {
    title: "Home",
    index: "home",
  },
});

export default PageState;
