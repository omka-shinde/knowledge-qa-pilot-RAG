import { NextResponse } from "next/server";
import { isAppError } from "@/services/ai";
import { buildContext } from "@/services/context";

type BuildContextRequestBody = {
  results?: unknown;
  searchQuery?: unknown;
  intent?: unknown;
  maxTokens?: unknown;
  maxItems?: unknown;
  minRank?: unknown;
};

/**
 * Phase 5: ranked search hits → clean, token-bounded context.
 * Does not call Haiku, PostgreSQL, or Sonnet.
 */
export async function POST(request: Request) {
  let body: BuildContextRequestBody;

  try {
    body = (await request.json()) as BuildContextRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = buildContext({
      results: body.results,
      searchQuery: body.searchQuery,
      intent: body.intent,
      maxTokens: body.maxTokens,
      maxItems: body.maxItems,
      minRank: body.minRank,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Something went wrong while building context." },
      { status: 500 },
    );
  }
}
