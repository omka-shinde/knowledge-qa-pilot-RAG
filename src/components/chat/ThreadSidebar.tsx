"use client";

type ThreadListItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type ThreadSidebarProps = {
  threads: ThreadListItem[];
  activeThreadId: string | null;
  loading?: boolean;
  onSelect: (threadId: string) => void;
  onNewChat: () => void;
  onDelete: (threadId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

function formatUpdatedAt(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  loading,
  onSelect,
  onNewChat,
  onDelete,
  collapsed,
  onToggleCollapsed,
}: ThreadSidebarProps) {
  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Show chats"
          className="m-2 rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          className="mx-2 rounded-lg bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onNewChat}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Hide sidebar"
          className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-4 text-xs text-zinc-500">Loading chats…</p>
        ) : threads.length === 0 ? (
          <p className="px-2 py-4 text-xs text-zinc-500">
            No chats yet. Start a new conversation.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => {
              const active = thread.id === activeThreadId;
              return (
                <li key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    className={[
                      "w-full rounded-lg px-2.5 py-2 text-left transition",
                      active
                        ? "bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
                        : "hover:bg-white/80 dark:hover:bg-zinc-900/80",
                    ].join(" ")}
                  >
                    <span className="block truncate pr-6 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {thread.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-500">
                      {formatUpdatedAt(thread.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(thread.id);
                    }}
                    className="absolute right-1.5 top-1.5 hidden rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 group-hover:block dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
