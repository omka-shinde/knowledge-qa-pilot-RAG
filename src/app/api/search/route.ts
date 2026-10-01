import { NextResponse } from "next/server";
import { isAppError } from "@/services/ai";
import { searchKnowledge } from "@/services/search";

type SearchRequestBody = {
  searchQuery?: unknown;
  limit?: unknown;
};

/**
 * Phase 4: searchQuery → PostgreSQL full-text search → ranked knowledge hits.
 * Does not call Haiku, Context Builder, or Sonnet.
 */
export async function POST(request: Request) {
  let body: SearchRequestBody;

  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await searchKnowledge(body.searchQuery, {
      limit: body.limit,
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
      { error: "Something went wrong while searching the knowledge base." },
      { status: 500 },
    );
  }
}
