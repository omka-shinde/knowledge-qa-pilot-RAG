import { NextResponse } from "next/server";
import { AuthError, requireSessionUser } from "@/lib/auth";
import { isAppError } from "@/services/ai";
import { askQuestion } from "@/services/ask";
import { validateQuestionInput } from "@/services/ai/validation";
import {
  appendMessage,
  getRecentMessagesForMemory,
  resolveThreadForAsk,
} from "@/services/chat/threads";

type AskRequestBody = {
  question?: unknown;
  threadId?: unknown;
};

/**
 * Full Q&A pipeline scoped to the logged-in user + chat thread memory.
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
    const user = await requireSessionUser();
    const question = validateQuestionInput(body.question);
    const requestedThreadId =
      typeof body.threadId === "string" && body.threadId.trim()
        ? body.threadId.trim()
        : null;

    const thread = await resolveThreadForAsk({
      userId: user.id,
      threadId: requestedThreadId,
      question,
    });

    // Memory: prior turns in this thread (before we append the new user message).
    const conversationHistory = await getRecentMessagesForMemory(thread.id, 12);

    await appendMessage({
      threadId: thread.id,
      role: "user",
      content: question,
    });

    const result = await askQuestion(question, {
      userId: user.id,
      conversationHistory,
    });

    const assistantMessage = await appendMessage({
      threadId: thread.id,
      role: "assistant",
      content: result.answer,
      sources: result.sources,
      cached: result.cached,
    });

    return NextResponse.json({
      ...result,
      threadId: thread.id,
      threadTitle: thread.title,
      userMessageId: undefined,
      assistantMessageId: assistantMessage.id,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while answering the question.";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
