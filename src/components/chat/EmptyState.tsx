"use client";

import { useEffect, useState } from "react";

type SuggestionStatus = "loading" | "ready" | "processing" | "empty";

type SuggestionsResponse = {
  questions?: string[];
  filename?: string | null;
  status?: "ready" | "processing" | "empty";
};

export function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (question: string) => void;
}) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<SuggestionStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/suggestions");
        if (!response.ok) {
          if (!cancelled) {
            setStatus("empty");
          }
          return;
        }
        const data = (await response.json()) as SuggestionsResponse;
        if (cancelled) {
          return;
        }
        const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
        setQuestions(nextQuestions);
        setFilename(data.filename ?? null);
        if (data.status === "processing") {
          setStatus("processing");
          timer = window.setTimeout(() => {
            void load();
          }, 4000);
          return;
        }
        setStatus(nextQuestions.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) {
          setStatus("empty");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const subtitle =
    status === "loading"
      ? "Looking through your documents for questions you can ask."
      : status === "processing" && questions.length === 0
        ? `Indexing ${filename ?? "your document"}. Suggested questions will show up when it's ready.`
        : questions.length > 0
          ? `Suggested from ${filename ?? "your document"}. Answers use only that content.`
          : "Upload a document and questions from that file will show up here.";

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <svg
          className="h-7 w-7 text-zinc-600 dark:text-zinc-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h2 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
        Ask about your documents
      </h2>
      <p className="mb-8 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {subtitle}
        {status === "processing" && questions.length > 0
          ? " A newer upload is still indexing."
          : ""}
      </p>

      {status === "loading" ? (
        <div className="grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-[4.5rem] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      ) : questions.length > 0 ? (
        <div className="grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
          {questions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onSuggestionClick(question)}
              className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-[#242424] dark:text-zinc-300 dark:hover:border-zinc-600"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
