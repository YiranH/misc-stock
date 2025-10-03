const REQUIRED_ENV_VARS = ['MONGODB_URI'] as const;

type EnvVar = (typeof REQUIRED_ENV_VARS)[number];

type EnvShape = {
  MONGODB_URI: string;
  MONGODB_DB?: string;
  REFRESH_TOKEN?: string;
  YAHOO_APP_ID?: string;
};

function readEnvVar(key: EnvVar): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export function getMongoUri(): string {
  return readEnvVar('MONGODB_URI');
}

export function getMongoDbName(): string {
  const fromEnv = process.env.MONGODB_DB;
  if (fromEnv && fromEnv.trim().length) return fromEnv.trim();
  return 'stock-analyzer';
}

export function getRefreshToken(): string | null {
  const value = process.env.REFRESH_TOKEN;
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function getEnvSnapshot(): EnvShape {
  return {
    MONGODB_URI: process.env.MONGODB_URI ?? '',
    MONGODB_DB: process.env.MONGODB_DB,
    REFRESH_TOKEN: process.env.REFRESH_TOKEN,
    YAHOO_APP_ID: process.env.YAHOO_APP_ID,
  };
}
