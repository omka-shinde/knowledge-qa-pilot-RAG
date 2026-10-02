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

function AppShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView =
    searchParams.get("view") === "documents" ? "documents" : "chat";
  const [view, setView] = useState<"chat" | "documents">(initialView);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setView(searchParams.get("view") === "documents" ? "documents" : "chat");
  }, [searchParams]);

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
        setActiveThreadId(null);
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
          setView("documents");
          router.replace("/?view=documents");
        }}
        onOpenChat={() => {
          setView("chat");
          router.replace("/");
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
            onSelect={(id) => setActiveThreadId(id)}
            onNewChat={() => setActiveThreadId(null)}
            onDelete={(id) => void handleDeleteThread(id)}
          />
          <ChatPanel
            threadId={activeThreadId}
            onThreadChange={(thread) => {
              if (!thread) {
                setActiveThreadId(null);
                return;
              }
              setActiveThreadId(thread.id);
            }}
            onThreadsRefresh={() => void refreshThreads()}
          />
        </div>
      ) : (
        <DocumentsPanel
          onBack={() => {
            setView("chat");
            router.replace("/");
          }}
        />
      )}
    </div>
  );
}

export function AppShell() {
  return <AppShellInner />;
}
