import { getConfig } from 'backend/config/config';

export interface FrontendConfig {
  BackendURL: string;
}

const appConfig = getConfig();

export function getFrontendConfig(): FrontendConfig {
  if (process.env.NODE_ENV === 'development') {
    return {
      BackendURL: 'http://localhost:3001',
    };
  }

  return {
    BackendURL: process.env.REACT_APP_BACKEND_URL ?? appConfig.BackendURL,
  };
}
