export function ThinkingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3 sm:px-6" role="status" aria-label="Answer is being generated">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-700 dark:bg-[#242424]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
        </span>
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"
            style={{ animationDelay: "0.2s" }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"
            style={{ animationDelay: "0.4s" }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
        </span>
        <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">
          Searching the knowledge base…
        </span>
      </div>
    </div>
  );
}
