import React, { useEffect } from 'react';
import User from 'backend/user/user';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import BackendUserClient from '../api/users/client';
import { UserState, UserIsAuthenticated } from '../state/store';

interface Props {
  children: React.ReactNode;
}

function AuthenticatedPage(props: Props) {
  const [isAuthenticated, setIsAuthenticated] = useRecoilState(UserIsAuthenticated);
  const [_, setUser] = useRecoilState(UserState);
  const userClient = new BackendUserClient('http://localhost:3001');
  const navigate = useNavigate();
  const { children } = props;

  useEffect(() => {
    userClient.GetAuthenticatedUser().then((user: User) => {
      setUser(user);
      setIsAuthenticated(true);
    }).catch((err) => {
      console.log(err);
      navigate('/login');
    });
  }, []);

  if (!isAuthenticated) {
    return null;
  }
  return (
    <div>
      {children}
    </div>
  );
}

export default AuthenticatedPage;
