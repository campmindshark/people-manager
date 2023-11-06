export interface Config {
  CORSWhitelist: string[];

  GoogleOAuthClientID: string;
  GoogleOAuthClientSecret: string;
  GoogleOAuthCallbackURL: string;

  Port: number;
  FrontendURL: string;

  JWTSecret: string;
}

function getCORSWhitelist(): string[] {
  const corsWhitelistCSV =
    (process.env.CORS_WHITELIST_CSV as string) ??
    "http://localhost:3000,http://localhost:3001";
  var corsWhitelist = corsWhitelistCSV.split(",");
  return corsWhitelist;
}

export function getConfig(): Config {
  const config: Config = {
    CORSWhitelist: getCORSWhitelist(),

    GoogleOAuthClientID: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
    GoogleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
    GoogleOAuthCallbackURL:
      (process.env.GOOGLE_OAUTH_CALLBACK_URL as string) ??
      "http://localhost:3001/auth/google/callback",

    Port: parseInt(process.env.PORT as string) ?? 3001,
    FrontendURL: (process.env.CLIENT_URL as string) ?? "http://localhost:3000",

    JWTSecret: (process.env.JWT_SECRET as string) ?? "yerrrrr",
  };

  return config;
}
