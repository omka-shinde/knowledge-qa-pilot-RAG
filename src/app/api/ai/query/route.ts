import { NextResponse } from "next/server";
import { isAppError, processQuestion } from "@/services/ai";

type QueryRequestBody = {
  question?: unknown;
};

/**
 * Phase 3: question → Claude Haiku → { intent, searchQuery }.
 * Does not search PostgreSQL, build context, or call Sonnet.
 */
export async function POST(request: Request) {
  let body: QueryRequestBody;

  try {
    body = (await request.json()) as QueryRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await processQuestion(body.question);
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Something went wrong while understanding the question." },
      { status: 500 },
    );
  }
}
