import { NextResponse } from "next/server";
import { isAppError } from "@/services/ai";
import { askQuestion } from "@/services/ask";

type AskRequestBody = {
  question?: unknown;
};

/**
 * Phase 7: full Q&A pipeline via direct service calls.
 * Haiku → PostgreSQL search → Context Builder → Sonnet
 */
export async function POST(request: Request) {
  let body: AskRequestBody;

  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await askQuestion(body.question);
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Something went wrong while answering the question." },
      { status: 500 },
    );
  }
}
