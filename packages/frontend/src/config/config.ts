import { getConfig } from 'backend/config/config';

export interface FrontendConfig {
  BackendURL: string;
}

const appConfig = getConfig();

export function GetFrontendConfig(): FrontendConfig {
  return {
    BackendURL: process.env.REACT_APP_BACKEND_URL ?? appConfig.BackendURL,
  };
}
