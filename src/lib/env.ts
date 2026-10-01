/**
 * Central place for reading environment variables.
 * Secrets must never be hardcoded — set them in `.env.local` or the host.
 */

const DEFAULT_HAIKU_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_SONNET_MODEL = "claude-sonnet-4-6";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value;
}

export function getDatabaseUrl(): string {
  const url = readEnv("DATABASE_URL");
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a PostgreSQL connection string.",
    );
  }
  return url;
}

export function getAnthropicApiKey(): string {
  const key = readEnv("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and provide an Anthropic API key.",
    );
  }
  return key;
}

export function getAnthropicApiKeyOptional(): string | undefined {
  return readEnv("ANTHROPIC_API_KEY");
}

/**
 * Configurable Haiku model ID. Defaults to a documented Haiku snapshot.
 */
export function getHaikuModel(): string {
  return readEnv("ANTHROPIC_HAIKU_MODEL") ?? DEFAULT_HAIKU_MODEL;
}

/**
 * Configurable Sonnet model ID. Defaults to a documented Sonnet snapshot.
 */
export function getSonnetModel(): string {
  return readEnv("ANTHROPIC_SONNET_MODEL") ?? DEFAULT_SONNET_MODEL;
}

export const DEFAULT_ANTHROPIC_HAIKU_MODEL = DEFAULT_HAIKU_MODEL;
export const DEFAULT_ANTHROPIC_SONNET_MODEL = DEFAULT_SONNET_MODEL;

export const env = {
  get databaseUrl() {
    return getDatabaseUrl();
  },
  get anthropicApiKey() {
    return getAnthropicApiKey();
  },
  get haikuModel() {
    return getHaikuModel();
  },
  get sonnetModel() {
    return getSonnetModel();
  },
};
