import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}
