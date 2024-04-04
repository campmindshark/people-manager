export interface Config {
  ActiveRosterID: number;
  BackendURL: string;
  CORSWhitelist: string[];
  Environment: string;
  FrontendURL: string;
  GoogleOAuthClientID: string;
  GoogleOAuthClientSecret: string;
  GoogleOAuthCallbackURL: string;
  JWTSecret: string;
  Port: number;
  PostgresConnectionURL: string;
}

function getCORSWhitelist(): string[] {
  const corsWhitelistCSV =
    (process.env.CORS_WHITELIST_CSV as string) ?? 'http://localhost:3000';
  const corsWhitelist = corsWhitelistCSV.split(',');
  return corsWhitelist;
}

export function getConfig(): Config {
  const config: Config = {
    ActiveRosterID: parseInt(
      (process.env.ACTIVE_ROSTER_ID as string) ?? '1',
      10,
    ),
    BackendURL: (process.env.BACKEND_URL as string) ?? 'http://localhost:3001',
    CORSWhitelist: getCORSWhitelist(),
    Environment: (process.env.NODE_ENV as string) ?? 'development',
    FrontendURL:
      (process.env.FRONTEND_URL as string) ?? 'http://localhost:3000',
    GoogleOAuthClientID: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
    GoogleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
    GoogleOAuthCallbackURL:
      (process.env.GOOGLE_OAUTH_CALLBACK_URL as string) ??
      'http://localhost:3001/api/auth/google/callback',
    JWTSecret: (process.env.JWT_SECRET as string) ?? 'yerrrrr',
    Port: parseInt((process.env.BACKEND_PORT as string) ?? '3001', 10),
    PostgresConnectionURL:
      (process.env.POSTGRES_CONNECTION_URL as string) ?? '',
  };

  return config;
}
