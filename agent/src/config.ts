export interface Config {
  matrix: {
    homeserverUrl: string | undefined;
    accessToken: string | undefined;
    userId: string | undefined;
  };
  opencode: {
    baseUrl: string;
    username: string;
    password: string | undefined;
  };
  agentsFile: string;
  logLevel: string;
}

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function getEnvWithDefault(key: string, defaultValue: string): string {
  return getEnv(key) ?? defaultValue;
}

export function loadConfig(): Config {
  return {
    matrix: {
      homeserverUrl: getEnv('MATRIX_HOMESERVER_URL'),
      accessToken: getEnv('MATRIX_ACCESS_TOKEN'),
      userId: getEnv('MATRIX_USER_ID'),
    },
    opencode: {
      baseUrl: getEnvWithDefault('OPENCODE_BASE_URL', 'http://localhost:4096'),
      username: getEnvWithDefault('OPENCODE_USERNAME', 'opencode'),
      password: getEnv('OPENCODE_PASSWORD'),
    },
    logLevel: getEnvWithDefault('LOG_LEVEL', 'info'),
    agentsFile: getEnvWithDefault('AGENTS_FILE', '/workspace/AGENTS.md'),
  };
}