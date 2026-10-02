"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "@/components/chat/ChatHeader";

type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
        if (!cancelled && data.user) {
          setUser(data.user);
          setName(data.user.name);
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

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameError(null);
    setNameMessage(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        user?: SessionUser;
        error?: string;
      };
      if (!response.ok) {
        setNameError(data.error ?? "Failed to update name.");
        return;
      }
      if (data.user) {
        setUser(data.user);
        setName(data.user.name);
      }
      setNameMessage("Name updated.");
      router.refresh();
    } catch {
      setNameError("Unable to reach the server.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    if (!currentPassword.trim()) {
      setPasswordError("Current password is required.");
      setSavingPassword(false);
      return;
    }
    if (!newPassword) {
      setPasswordError("New password is required.");
      setSavingPassword(false);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      setSavingPassword(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      setSavingPassword(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPasswordError(data.error ?? "Failed to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } catch {
      setPasswordError("Unable to reach the server.");
    } finally {
      setSavingPassword(false);
    }
  }

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
                My profile
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Update your display name and password.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Back
            </Link>
          </div>

          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Email
            </p>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {user?.email}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Email cannot be changed.</p>
          </div>

          <form
            onSubmit={(e) => void saveName(e)}
            className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Change profile name
            </h3>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            {nameError && (
              <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>
            )}
            {nameMessage && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {nameMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={savingName}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingName ? "Saving…" : "Save name"}
            </button>
          </form>

          <form
            noValidate
            onSubmit={(e) => void savePassword(e)}
            className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Change password
            </h3>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Current password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Confirm new password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {passwordError}
              </p>
            )}
            {passwordMessage && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {passwordMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
