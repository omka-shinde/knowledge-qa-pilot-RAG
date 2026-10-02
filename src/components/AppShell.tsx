"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";

type SessionUser = {
  id: string;
  name: string;
  email: string;
};

type ThreadListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

function chatHref(
  threadId: string | null,
  view: "chat" | "documents" = "chat",
): string {
  const params = new URLSearchParams();
  if (view === "documents") {
    params.set("view", "documents");
  }
  if (threadId) {
    params.set("thread", threadId);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function AppShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawThread = searchParams.get("thread")?.trim() ?? "";
  const activeThreadId = rawThread || null;
  const view = searchParams.get("view") === "documents" ? "documents" : "chat";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const goTo = useCallback(
    (href: string, method: "push" | "replace") => {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === href) {
        return;
      }
      if (method === "push") {
        router.push(href);
      } else {
        router.replace(href);
      }
    },
    [router],
  );

  const refreshThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const response = await fetch("/api/threads");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { threads?: ThreadListItem[] };
      setThreads(data.threads ?? []);
    } catch {
      // ignore
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const data = (await response.json()) as { user?: SessionUser | null };
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!loadingUser && user) {
      void refreshThreads();
    }
  }, [loadingUser, user, refreshThreads]);

  async function handleDeleteThread(threadId: string) {
    const ok = window.confirm("Delete this chat permanently?");
    if (!ok) {
      return;
    }
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        return;
      }
      if (activeThreadId === threadId) {
        goTo(chatHref(null, view), "replace");
      }
      await refreshThreads();
    } catch {
      // ignore
    }
  }

  if (loadingUser) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatHeader
        activeView={view}
        onOpenDocuments={() => {
          goTo(chatHref(activeThreadId, "documents"), "push");
        }}
        onOpenChat={() => {
          goTo(chatHref(activeThreadId, "chat"), "push");
        }}
        userName={user?.name}
        userEmail={user?.email}
      />
      {view === "chat" ? (
        <div className="flex min-h-0 flex-1">
          <ThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            loading={threadsLoading}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            threadHref={(id) => chatHref(id, "chat")}
            newChatHref={chatHref(null, "chat")}
            onDelete={(id) => void handleDeleteThread(id)}
          />
          <ChatPanel
            threadId={activeThreadId}
            onThreadChange={(thread) => {
              const nextId = thread?.id ?? null;
              if (nextId === activeThreadId) {
                return;
              }
              goTo(chatHref(nextId, "chat"), "replace");
            }}
            onThreadsRefresh={() => void refreshThreads()}
          />
        </div>
      ) : (
        <DocumentsPanel
          onBack={() => {
            goTo(chatHref(activeThreadId, "chat"), "push");
          }}
        />
      )}
    </div>
  );
}

export function AppShell() {
  return <AppShellInner />;
}
