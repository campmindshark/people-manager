import React, { useEffect } from 'react';
import User from 'backend/user/user';
import { useRecoilState } from 'recoil';
import { UserState, UserIsAuthenticated } from '../state/store';

interface Props {
  children: React.ReactNode;
}

const loadUser = async () => {
  const response = await fetch('http://localhost:3001/auth/login/success', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Credentials': 'true',
    },
  });

  if (response.status !== 200) {
    if (window.location.href !== 'http://localhost:3000/login') {
      window.location.href = 'http://localhost:3000/login';
      return null;
    }
  }

  const responseData = await response.json();
  return responseData.user;
};

function AuthenticatedPage(props: Props) {
  const [isAuthenticated, setIsAuthenticated] = useRecoilState(UserIsAuthenticated);
  const [_, setUser] = useRecoilState(UserState);
  const { children } = props;

  useEffect(() => {
    loadUser().then((user: User) => {
      setUser(user);
      setIsAuthenticated(true);
    }).catch((err) => {
      console.log(err);
      setIsAuthenticated(false);
    });
  }, []);

  if (!isAuthenticated) {
    return <p>Loading...</p>;
  }
  return (
    <div>
      {children}
    </div>
  );
}

export default AuthenticatedPage;
