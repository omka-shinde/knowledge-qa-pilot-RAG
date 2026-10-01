import { NextResponse } from "next/server";
import { generateAnswer, isAppError } from "@/services/ai";

type AnswerRequestBody = {
  question?: unknown;
  contextText?: unknown;
  intent?: unknown;
  searchQuery?: unknown;
};

/**
 * Phase 6: question + Phase 5 context → Claude Sonnet → natural-language answer.
 * Does not run Haiku, PostgreSQL search, or Context Builder.
 * Does not replace the full `/api/ask` pipeline.
 */
export async function POST(request: Request) {
  let body: AnswerRequestBody;

  try {
    body = (await request.json()) as AnswerRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await generateAnswer({
      question: body.question,
      contextText: body.contextText,
      intent: body.intent,
      searchQuery: body.searchQuery,
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
      { error: "Something went wrong while generating the answer." },
      { status: 500 },
    );
  }
}
