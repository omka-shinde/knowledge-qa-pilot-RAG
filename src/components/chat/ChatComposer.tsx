"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (question: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-[#1a1a1a] sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 transition focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-[#242424] dark:focus-within:border-zinc-500">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the knowledge base…"
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none disabled:cursor-not-allowed dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send question"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
        >
          {disabled ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-400 dark:text-zinc-500">
        Press Enter to send, Shift + Enter for a new line
      </p>
    </div>
  );
}
