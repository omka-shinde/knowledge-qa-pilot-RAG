"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import type { AskSource, ChatMessage } from "@/components/chat/types";

type AskResponse = {
  answer?: string;
  sources?: AskSource[];
  cached?: boolean;
  threadId?: string;
  threadTitle?: string;
  error?: string;
  message?: string;
};

type ThreadMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AskSource[] | null;
  cached?: boolean;
};

type ChatPanelProps = {
  threadId: string | null;
  onThreadChange: (thread: { id: string; title?: string } | null) => void;
  onThreadsRefresh?: () => void;
};

export function ChatPanel({
  threadId,
  onThreadChange,
  onThreadsRefresh,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<string | null>(threadId);

  useEffect(() => {
    activeThreadRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const loadThread = useCallback(
    async (id: string | null) => {
      if (!id) {
        setMessages([]);
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/threads/${id}`);
        if (!response.ok) {
          setMessages([]);
          onThreadChange(null);
          return;
        }
        const data = (await response.json()) as {
          thread?: { id: string; title: string; messages: ThreadMessageDto[] };
        };
        const thread = data.thread;
        if (!thread) {
          setMessages([]);
          return;
        }
        setMessages(
          thread.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: Array.isArray(m.sources) ? m.sources.slice(0, 1) : [],
            cached: m.cached === true,
          })),
        );
      } catch {
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [onThreadChange],
  );

  useEffect(() => {
    void loadThread(threadId);
  }, [threadId, loadThread]);

  async function handleSend(question: string) {
    const tempUserId = `local-user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: question },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          threadId: activeThreadRef.current,
        }),
      });

      const data = (await response.json()) as AskResponse;

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-err-${Date.now()}`,
            role: "assistant",
            content:
              data.error ?? data.message ?? "Something went wrong. Please try again.",
            isError: true,
          },
        ]);
        return;
      }

      if (data.threadId) {
        onThreadChange({ id: data.threadId, title: data.threadTitle });
        activeThreadRef.current = data.threadId;
        onThreadsRefresh?.();
      }

      if (!data.answer?.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-empty-${Date.now()}`,
            role: "assistant",
            content: "No answer was returned. Please try again.",
            isError: true,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `local-asst-${Date.now()}`,
          role: "assistant",
          content: data.answer!,
          sources: Array.isArray(data.sources) ? data.sources.slice(0, 1) : [],
          cached: data.cached === true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-net-${Date.now()}`,
          role: "assistant",
          content: "Unable to reach the server. Please try again.",
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Loading chat…
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onSuggestionClick={handleSend} />
        ) : (
          <div className="mx-auto w-full max-w-3xl py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <ThinkingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ChatComposer onSend={handleSend} disabled={isLoading || loadingHistory} />
    </div>
  );
}
