import { atom, selector } from 'recoil';
import User from 'react-backend/user/user';
import BackendUserClient from '../api/users/client';

export const UsersState = selector<User[]>({
  key: 'users',
  get: async () => {
    const apiMethod = new BackendUserClient('http://localhost:8001');
    const users = await apiMethod.GetAllUsers();

    return users;
  },
});

interface PageData {
  title: string
  index: string
}

const PageState = atom<PageData>({
  key: 'pageState',
  default: {
    title: 'Home',
    index: 'home',
  },
});

export default PageState;
