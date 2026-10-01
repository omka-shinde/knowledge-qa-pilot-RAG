export type AskSource = {
  id: string;
  question: string;
  sourceDocument: string;
  sourcePage: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AskSource[];
  isError?: boolean;
  /** Served from ask_cache — skipped AI/search. */
  cached?: boolean;
};
