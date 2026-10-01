"use client";

import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import type { AskSource, ChatMessage } from "@/components/chat/types";

type AskResponse = {
  answer?: string;
  sources?: AskSource[];
  cached?: boolean;
  error?: string;
  message?: string;
};

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(question: string) {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: "user", content: question },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = (await response.json()) as AskResponse;

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            content:
              data.error ?? data.message ?? "Something went wrong. Please try again.",
            isError: true,
          },
        ]);
        return;
      }

      if (!data.answer?.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
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
          id: nextMessageId(),
          role: "assistant",
          content: data.answer!,
          // Sources are already sorted highest-rank-first (see context builder);
          // only the top match is shown to keep the UI focused.
          sources: Array.isArray(data.sources) ? data.sources.slice(0, 1) : [],
          cached: data.cached === true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
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
        {messages.length === 0 ? (
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

      <ChatComposer onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
