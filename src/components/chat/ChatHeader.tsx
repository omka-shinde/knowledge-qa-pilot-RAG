import { DarkModeToggle } from "@/components/chat/DarkModeToggle";

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-[#1a1a1a]/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-sm">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Knowledge Q&amp;A Pilot
          </h1>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            Answers grounded in the knowledge base
          </p>
        </div>
      </div>

      <DarkModeToggle />
    </header>
  );
}
