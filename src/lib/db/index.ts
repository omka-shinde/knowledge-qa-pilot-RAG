import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __qaPilotDb?: Db;
  __qaPilotSql?: Sql;
};

type PostgresSsl = { rejectUnauthorized: false } | undefined;

/**
 * Railway (and most cloud Postgres) require TLS. Local Docker does not.
 */
function postgresSslOption(connectionString: string): PostgresSsl {
  try {
    const host = new URL(connectionString).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return undefined;
    }
  } catch {
    // Fall through to require TLS for non-parseable remote URLs.
  }
  // Railway's managed certs often need this for Node TLS validation.
  return { rejectUnauthorized: false };
}

function createSqlClient(connectionString: string, max: number): Sql {
  const ssl = postgresSslOption(connectionString);
  return postgres(connectionString, {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(ssl ? { ssl } : {}),
  });
}

/**
 * Lazy PostgreSQL + Drizzle client for API routes and services.
 * Does not connect until first call — safe for builds without DATABASE_URL.
 */
export function getDb(): Db {
  if (globalForDb.__qaPilotDb) {
    return globalForDb.__qaPilotDb;
  }

  const connectionString = getDatabaseUrl();
  const sql = createSqlClient(connectionString, 10);
  const db = drizzle(sql, { schema });

  globalForDb.__qaPilotSql = sql;
  globalForDb.__qaPilotDb = db;

  return db;
}

/**
 * Runs a lightweight connectivity check against PostgreSQL.
 * Useful for health checks and verifying env configuration.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const connectionString = getDatabaseUrl();
  const sql = createSqlClient(connectionString, 1);

  try {
    await sql`select 1`;
    return true;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export type { Db };
