import React, { useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { getFrontendConfig } from '../config/config';
import BackendUserClient, { AuthResponse } from '../api/users/client';
import { UserState, UserIsAuthenticated } from '../state/store';

const frontendConfig = getFrontendConfig();

interface Props {
  children: React.ReactNode;
}

function AuthenticatedPage(props: Props) {
  const [isAuthenticated, setIsAuthenticated] =
    useRecoilState(UserIsAuthenticated);
  const [_, setUser] = useRecoilState(UserState);

  const userClient = useMemo(
    () => new BackendUserClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );

  const navigate = useNavigate();
  const { children } = props;

  useEffect(() => {
    const doAuth = async () => {
      if (isAuthenticated === true) {
        return;
      }

      try {
        const response: AuthResponse = await userClient.GetAuthenticatedUser();
        if (response.success === true) {
          console.log('auth success');
          setUser(response.user);
          if (isAuthenticated === false) {
            setIsAuthenticated(true);
          }
        } else {
          console.log('auth failed');
          navigate('/login');
        }
      } catch (err) {
        console.log('auth error', err);
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
