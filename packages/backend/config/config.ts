export interface Config {
  Environment: string;
  CORSWhitelist: string[];

  PostgresConnectionURL: string;

  GoogleOAuthClientID: string;
  GoogleOAuthClientSecret: string;
  GoogleOAuthCallbackURL: string;

  Port: number;
  FrontendURL: string;
  BackendURL: string;

  JWTSecret: string;
}

function getCORSWhitelist(): string[] {
  const corsWhitelistCSV =
    (process.env.CORS_WHITELIST_CSV as string) ??
    'http://localhost:3000,http://localhost:3001';
  const corsWhitelist = corsWhitelistCSV.split(',');
  return corsWhitelist;
}

export function getConfig(): Config {
  const config: Config = {
    Environment: (process.env.NODE_ENV as string) ?? 'development',
    CORSWhitelist: getCORSWhitelist(),

    PostgresConnectionURL:
      (process.env.POSTGRES_CONNECTION_URL as string) ?? '',

    GoogleOAuthClientID: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
    GoogleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
    GoogleOAuthCallbackURL:
      (process.env.GOOGLE_OAUTH_CALLBACK_URL as string) ??
      'http://localhost:3001/api/auth/google/callback',

    Port: parseInt((process.env.BACKEND_PORT as string) ?? '3001', 10),
    FrontendURL:
      (process.env.FRONTEND_URL as string) ?? 'http://localhost:3000',
    BackendURL: (process.env.BACKEND_URL as string) ?? 'http://localhost:3001',

    JWTSecret: (process.env.JWT_SECRET as string) ?? 'yerrrrr',
  };

  return config;
}
