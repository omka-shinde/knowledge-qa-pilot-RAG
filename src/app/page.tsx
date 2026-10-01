import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function Home() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatHeader />
      <ChatPanel />
    </div>
  );
}
