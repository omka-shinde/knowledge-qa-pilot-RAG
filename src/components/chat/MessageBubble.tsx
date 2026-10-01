import type { ChatMessage } from "@/components/chat/types";
import { MarkdownContent } from "@/components/chat/MarkdownContent";

function Avatar({ role }: { role: ChatMessage["role"] }) {
  const isUser = role === "user";
  return (
    <div
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
        isUser
          ? "bg-zinc-900 dark:bg-zinc-700"
          : "bg-gradient-to-br from-purple-500 to-blue-600"
      }`}
    >
      {isUser ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      )}
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex animate-fade-in-up gap-3 px-4 py-3 sm:px-6 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <Avatar role={message.role} />

      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "whitespace-pre-wrap bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : message.isError
                ? "whitespace-pre-wrap border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                : "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-[#242424] dark:text-zinc-100"
          }`}
        >
          {isUser || message.isError ? (
            message.content
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {!isUser && message.cached && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Instant reply · saved tokens
          </p>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {message.sources.length > 1 ? "Sources" : "Source"}
            </p>
            <ul className="space-y-1">
              {message.sources.map((source) => (
                <li
                  key={source.id}
                  className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {source.sourceDocument}
                    {source.sourcePage !== null ? ` (p.${source.sourcePage})` : ""}
                  </span>
                  {" — "}
                  {source.question}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
