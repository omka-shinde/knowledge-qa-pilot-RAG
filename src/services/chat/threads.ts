/**
 * Chat threads + messages (ChatGPT-style history per user).
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  chatMessages,
  chatThreads,
  type ChatMessageSource,
  type ChatMessageRole,
} from "@/lib/db/schema";

export type ThreadListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  sources: ChatMessageSource[] | null;
  cached: boolean;
  createdAt: string;
};

export type ThreadDetail = ThreadListItem & {
  messages: ThreadMessage[];
};

function titleFromQuestion(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "New chat";
  }
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned;
}

export async function listThreads(userId: string): Promise<ThreadListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: chatThreads.id,
      title: chatThreads.title,
      createdAt: chatThreads.createdAt,
      updatedAt: chatThreads.updatedAt,
    })
    .from(chatThreads)
    .where(eq(chatThreads.userId, userId))
    .orderBy(desc(chatThreads.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createThread(
  userId: string,
  title = "New chat",
): Promise<ThreadListItem> {
  const db = getDb();
  const [created] = await db
    .insert(chatThreads)
    .values({ userId, title })
    .returning();

  if (!created) {
    throw new Error("Failed to create chat thread.");
  }

  return {
    id: created.id,
    title: created.title,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function getThreadForUser(
  threadId: string,
  userId: string,
): Promise<ThreadDetail | null> {
  const db = getDb();
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
    .limit(1);

  if (!thread) {
    return null;
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt));

  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ?? null,
      cached: m.cached === 1,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function renameThread(
  threadId: string,
  userId: string,
  title: string,
): Promise<ThreadListItem | null> {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    throw new Error("Title is required.");
  }

  const db = getDb();
  const [updated] = await db
    .update(chatThreads)
    .set({ title: trimmed.slice(0, 120), updatedAt: new Date() })
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
    .returning();

  if (!updated) {
    return null;
  }

  return {
    id: updated.id,
    title: updated.title,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteThread(
  threadId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
    .returning({ id: chatThreads.id });
  return deleted.length > 0;
}

export async function appendMessage(input: {
  threadId: string;
  role: ChatMessageRole;
  content: string;
  sources?: ChatMessageSource[] | null;
  cached?: boolean;
}): Promise<ThreadMessage> {
  const db = getDb();
  const [created] = await db
    .insert(chatMessages)
    .values({
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? null,
      cached: input.cached ? 1 : 0,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to save chat message.");
  }

  await db
    .update(chatThreads)
    .set({ updatedAt: new Date() })
    .where(eq(chatThreads.id, input.threadId));

  return {
    id: created.id,
    role: created.role,
    content: created.content,
    sources: created.sources ?? null,
    cached: created.cached === 1,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Ensure thread belongs to user; create one if threadId missing.
 * Sets title from the first question when still "New chat".
 */
export async function resolveThreadForAsk(input: {
  userId: string;
  threadId?: string | null;
  question: string;
}): Promise<ThreadListItem> {
  const db = getDb();

  if (input.threadId) {
    const [existing] = await db
      .select()
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.id, input.threadId),
          eq(chatThreads.userId, input.userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Chat thread not found.");
    }

    if (existing.title === "New chat") {
      const [updated] = await db
        .update(chatThreads)
        .set({
          title: titleFromQuestion(input.question),
          updatedAt: new Date(),
        })
        .where(eq(chatThreads.id, existing.id))
        .returning();
      if (updated) {
        return {
          id: updated.id,
          title: updated.title,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      }
    }

    return {
      id: existing.id,
      title: existing.title,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  return createThread(input.userId, titleFromQuestion(input.question));
}

/**
 * Recent messages for memory / multi-turn context (excludes the question just sent).
 */
export async function getRecentMessagesForMemory(
  threadId: string,
  limit = 12,
): Promise<Array<{ role: ChatMessageRole; content: string }>> {
  const db = getDb();
  const rows = await db
    .select({
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
  }));
}
