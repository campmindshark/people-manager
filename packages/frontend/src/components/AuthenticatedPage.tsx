import React, { useEffect, useMemo } from 'react';
import { getConfig } from 'backend/config/config';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import BackendUserClient, { AuthResponse } from '../api/users/client';
import { UserState, UserIsAuthenticated } from '../state/store';

const appConfig = getConfig();

interface Props {
  children: React.ReactNode;
}

function AuthenticatedPage(props: Props) {
  const [isAuthenticated, setIsAuthenticated] =
    useRecoilState(UserIsAuthenticated);
  const [_, setUser] = useRecoilState(UserState);

  const userClient = useMemo(
    () => new BackendUserClient(appConfig.BackendURL),
    [appConfig.BackendURL],
  );

  const navigate = useNavigate();
  const { children } = props;

  useEffect(() => {
    const doAuth = async () => {
      try {
        const response: AuthResponse = await userClient.GetAuthenticatedUser();
        if (response.success === true) {
          setUser(response.user);
          if (isAuthenticated === false) {
            setIsAuthenticated(true);
          }
        } else {
          console.log('auth failed');
          navigate('/login');
        }
      } catch (err) {
        console.log(err);
        navigate('/login');
      }
    };

    doAuth();
  }, []);

  if (!isAuthenticated) {
    return null;
  }
  return <div>{children}</div>;
}

export default AuthenticatedPage;
