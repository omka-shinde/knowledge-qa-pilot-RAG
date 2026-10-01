import { NextResponse } from "next/server";
import { checkDatabaseConnection, getDb } from "@/lib/db";
import { knowledgeEntries } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

function redactDatabaseUrl(): {
  present: boolean;
  host: string | null;
  port: string | null;
  database: string | null;
} {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return { present: false, host: null, port: null, database: null };
  }

  try {
    const parsed = new URL(raw);
    return {
      present: true,
      host: parsed.hostname || null,
      port: parsed.port || null,
      database: parsed.pathname.replace(/^\//, "") || null,
    };
  } catch {
    return { present: true, host: "unparseable", port: null, database: null };
  }
}

/**
 * Temporary diagnostics for Railway DB connectivity.
 * Safe: does not return credentials.
 */
export async function GET() {
  const target = redactDatabaseUrl();

  if (!target.present) {
    return NextResponse.json(
      {
        ok: false,
        target,
        error: "DATABASE_URL is not set on this service.",
      },
      { status: 503 },
    );
  }

  try {
    const connected = await checkDatabaseConnection();
    const db = getDb();
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(knowledgeEntries);
    const count = Number(rows[0]?.n ?? 0);

    return NextResponse.json({
      ok: connected,
      target,
      knowledgeEntries: count,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        target,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
