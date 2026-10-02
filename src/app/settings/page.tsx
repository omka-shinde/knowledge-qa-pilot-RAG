"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { DarkModeToggle } from "@/components/chat/DarkModeToggle";

type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatHeader
        activeView="chat"
        userName={user?.name}
        userEmail={user?.email}
        onOpenChat={() => router.push("/")}
        onOpenDocuments={() => router.push("/?view=documents")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Settings
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                App preferences for your account.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Back
            </Link>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Appearance
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Switch between light and dark mode
                </p>
              </div>
              <DarkModeToggle />
            </div>

            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Account
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Manage your name and password in{" "}
                <Link
                  href="/profile"
                  className="font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
                >
                  My profile
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
