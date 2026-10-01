"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

type DocumentItem = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  statusMessage: string | null;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "Queued",
  extracting: "Extracting text",
  chunking: "Chunking",
  embedding: "Embedding",
  ready: "Ready",
  failed: "Failed",
};

const PROCESSING: DocumentStatus[] = [
  "uploaded",
  "extracting",
  "chunking",
  "embedding",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: DocumentStatus): string {
  switch (status) {
    case "ready":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }
}

function ProgressSteps({ status }: { status: DocumentStatus }) {
  const steps: DocumentStatus[] = [
    "extracting",
    "chunking",
    "embedding",
    "ready",
  ];
  const currentIdx =
    status === "uploaded"
      ? -1
      : status === "failed"
        ? steps.length
        : steps.indexOf(status === "ready" ? "ready" : status);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {steps.map((step, idx) => {
        const done =
          status === "ready" || (currentIdx > idx && status !== "failed");
        const active = status === step;
        return (
          <span
            key={step}
            className={[
              "rounded px-2 py-0.5 text-[11px] font-medium",
              done
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : active
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
            ].join(" ")}
          >
            {STATUS_LABEL[step]}
            {active ? "…" : done ? " ✓" : ""}
          </span>
        );
      })}
    </div>
  );
}

export function DocumentsPanel({ onBack }: { onBack: () => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([]);
  const [maxFileBytes, setMaxFileBytes] = useState(20 * 1024 * 1024);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/documents");
    const data = (await response.json()) as {
      documents?: DocumentItem[];
      allowedExtensions?: string[];
      maxFileBytes?: number;
      error?: string;
    };
    if (!response.ok) {
      setError(data.error ?? "Failed to load documents.");
      return;
    }
    setDocuments(data.documents ?? []);
    if (data.allowedExtensions) {
      setAllowedExtensions(data.allowedExtensions);
    }
    if (typeof data.maxFileBytes === "number") {
      setMaxFileBytes(data.maxFileBytes);
    }
    setError(null);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Poll while any document is still processing.
  useEffect(() => {
    const busy = documents.some((d) => PROCESSING.includes(d.status));
    if (!busy) {
      return;
    }
    const timer = setInterval(() => {
      void loadDocuments();
    }, 1500);
    return () => clearInterval(timer);
  }, [documents, loadDocuments]);

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        document?: DocumentItem;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      await loadDocuments();
    } catch {
      setError("Unable to upload. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRetry(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "POST" });
      const data = (await response.json()) as {
        document?: DocumentItem;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Retry failed.");
        return;
      }
      await loadDocuments();
    } catch {
      setError("Unable to retry processing.");
    }
  }

  async function handleDelete(id: string, filename: string) {
    const ok = window.confirm(
      `Delete "${filename}" permanently? This removes all chunks and embeddings from the database.`,
    );
    if (!ok) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }
      await loadDocuments();
    } catch {
      setError("Unable to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  const accept = allowedExtensions.join(",");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Documents
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload PDF, Word, or text files. They are chunked, embedded, and
            searchable by the chatbot.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Back to chat
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <label
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition",
            uploading
              ? "border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-zinc-500",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept || ".pdf,.doc,.docx,.txt,.md"}
            disabled={uploading}
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {uploading ? "Uploading…" : "Click to upload a document"}
          </span>
          <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {(allowedExtensions.length
              ? allowedExtensions
              : [".pdf", ".docx", ".doc", ".txt", ".md"]
            ).join(" · ")}{" "}
            · max {Math.floor(maxFileBytes / (1024 * 1024))} MB
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {documents.length === 0 ? (
            <li className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No documents yet. Upload one to get started.
            </li>
          ) : (
            documents.map((doc) => (
              <li
                key={doc.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {doc.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatBytes(doc.fileSize)}
                      {doc.status === "ready"
                        ? ` · ${doc.chunkCount} chunks`
                        : ""}
                      {" · "}
                      {new Date(doc.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(doc.status)}`}
                    >
                      {STATUS_LABEL[doc.status]}
                    </span>
                    {doc.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(doc.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => void handleDelete(doc.id, doc.filename)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      {deletingId === doc.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {PROCESSING.includes(doc.status) && (
                  <ProgressSteps status={doc.status} />
                )}

                {doc.statusMessage && doc.status !== "ready" && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {doc.statusMessage}
                  </p>
                )}

                {doc.error && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {doc.error}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
