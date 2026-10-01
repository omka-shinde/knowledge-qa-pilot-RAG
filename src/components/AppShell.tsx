"use client";

import { useState } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";

export function AppShell() {
  const [view, setView] = useState<"chat" | "documents">("chat");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatHeader
        activeView={view}
        onOpenDocuments={() => setView("documents")}
        onOpenChat={() => setView("chat")}
      />
      {view === "chat" ? (
        <ChatPanel />
      ) : (
        <DocumentsPanel onBack={() => setView("chat")} />
      )}
    </div>
  );
}
