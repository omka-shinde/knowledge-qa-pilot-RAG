"use client";

import { useState, type ReactNode } from "react";
import { DarkModeToggle } from "@/components/chat/DarkModeToggle";

export const authInputClass =
  "h-11 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/15 dark:border-zinc-600 dark:bg-black/40 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-400 dark:focus:bg-black/60 dark:focus:ring-violet-500/20";

export const authLabelClass =
  "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200";

export const authButtonClass =
  "flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 justify-center overflow-x-hidden overflow-y-auto px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#f6f6f7] dark:bg-[#0b0b0d]" />
        <div className="absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.28),rgba(59,130,246,0.08)_45%,transparent_70%)] blur-2xl dark:bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.35),rgba(37,99,235,0.12)_42%,transparent_70%)]" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-700/20" />
        <div className="absolute -right-10 top-24 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-700/20" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 dark:opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(113 113 122 / 0.28) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="fixed top-4 right-4 z-10">
        <DarkModeToggle />
      </div>

      <div className="relative my-auto w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-500/30">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Knowledge Q&amp;A Pilot
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-[0_24px_70px_-28px_rgba(24,24,27,0.35)] ring-1 ring-black/5 dark:border-white/10 dark:bg-[#141418]/95 dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)] dark:ring-white/5">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-zinc-950 dark:text-white">
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 border-t border-zinc-200 pt-5 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          placeholder="Enter your password"
          onChange={(e) => onChange(e.target.value)}
          className={`${authInputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          {visible ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}
