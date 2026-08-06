export interface Config {
  ActiveRosterID: number;
  BackendURL: string;
  ChorePlanningEnabled: boolean;
  CORSWhitelist: string[];
  DevAuthBypass: boolean;
  Environment: string;
  FrontendURL: string;
  GoogleOAuthClientID: string;
  GoogleOAuthClientSecret: string;
  GoogleOAuthCallbackURL: string;
  JWTSecret: string;
  Port: number;
  PostgresConnectionURL: string;
  PostgresSSLCertPath: string;
}

function getCORSWhitelist(environment: NodeJS.ProcessEnv): string[] {
  const corsWhitelistCSV =
    (environment.CORS_WHITELIST_CSV as string) ?? 'http://localhost:3000';
  const corsWhitelist = corsWhitelistCSV.split(',');
  return corsWhitelist;
}

export function getConfig(environment = process.env): Config {
  const config: Config = {
    ActiveRosterID: parseInt(
      (environment.ACTIVE_ROSTER_ID as string) ?? '1',
      10,
    ),
    BackendURL: (environment.BACKEND_URL as string) ?? 'http://localhost:3001',
    ChorePlanningEnabled: environment.CHORE_PLANNING_ENABLED === 'true',
    CORSWhitelist: getCORSWhitelist(environment),
    DevAuthBypass:
      environment.DEV_AUTH_BYPASS === 'true' &&
      ((environment.NODE_ENV as string) ?? 'development') === 'development',
    Environment: (environment.NODE_ENV as string) ?? 'development',
    FrontendURL:
      (environment.FRONTEND_URL as string) ?? 'http://localhost:3000',
    GoogleOAuthClientID: environment.GOOGLE_OAUTH_CLIENT_ID as string,
    GoogleOAuthClientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET as string,
    GoogleOAuthCallbackURL:
      (environment.GOOGLE_OAUTH_CALLBACK_URL as string) ??
      'http://localhost:3001/api/auth/google/callback',
    JWTSecret: (environment.JWT_SECRET as string) ?? 'yerrrrr',
    Port: parseInt((environment.BACKEND_PORT as string) ?? '3001', 10),
    PostgresConnectionURL:
      (environment.POSTGRES_CONNECTION_URL as string) ?? '',
    PostgresSSLCertPath:
      '/usr/local/certs/ca-certificates/us-west-2-bundle.pem',
  };

  return config;
}
