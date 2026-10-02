"use client";

import { useRouter } from "next/navigation";
import { DarkModeToggle } from "@/components/chat/DarkModeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";

type ChatHeaderProps = {
  activeView?: "chat" | "documents";
  onOpenDocuments?: () => void;
  onOpenChat?: () => void;
  userName?: string | null;
  userEmail?: string | null;
};

export function ChatHeader({
  activeView = "chat",
  onOpenDocuments,
  onOpenChat,
  userName,
  userEmail,
}: ChatHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-[#1a1a1a]/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (onOpenChat) {
              onOpenChat();
            } else {
              router.push("/");
            }
          }}
          className="flex min-w-0 items-center gap-2 text-left"
        >
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
              Answers grounded in your documents
            </p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <nav className="flex items-center rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => {
              if (onOpenChat) {
                onOpenChat();
              } else {
                router.push("/");
              }
            }}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              activeView === "chat"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenDocuments) {
                onOpenDocuments();
              } else {
                router.push("/?view=documents");
              }
            }}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              activeView === "documents"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            Documents
          </button>
        </nav>
        <DarkModeToggle />
        <ProfileMenu userName={userName} userEmail={userEmail} />
      </div>
    </header>
  );
}
