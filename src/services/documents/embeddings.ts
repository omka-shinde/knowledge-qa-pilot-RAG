/**
 * OpenAI text-embedding-3-small helpers.
 * Requires OPENAI_API_KEY in the environment.
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_BATCH = 64;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

/**
 * Read a key from project env files so a stale Windows/user OPENAI_API_KEY
 * cannot override the project's `.env` / `.env.local` value.
 */
function readKeyFromEnvFiles(name: string): string | undefined {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      if (key !== name) {
        continue;
      }
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) {
        return value;
      }
    }
  }
  return undefined;
}

export function getOpenAIApiKey(): string {
  // Prefer project files over OS/process env (avoids stale User env keys).
  const key = readKeyFromEnvFiles("OPENAI_API_KEY") ?? readEnv("OPENAI_API_KEY");
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local for document embeddings.",
    );
  }
  // Keep process.env in sync so the OpenAI SDK / logs see the same key.
  process.env.OPENAI_API_KEY = key;
  return key;
}

export function getEmbeddingModel(): string {
  return (
    readKeyFromEnvFiles("OPENAI_EMBEDDING_MODEL") ??
    readEnv("OPENAI_EMBEDDING_MODEL") ??
    DEFAULT_EMBEDDING_MODEL
  );
}

function getClient(apiKey?: string): OpenAI {
  return new OpenAI({ apiKey: apiKey ?? getOpenAIApiKey() });
}

function normalizeEmbedding(values: number[]): number[] {
  if (values.length === EMBEDDING_DIMENSIONS) {
    return values;
  }
  if (values.length > EMBEDDING_DIMENSIONS) {
    return values.slice(0, EMBEDDING_DIMENSIONS);
  }
  return [...values, ...Array(EMBEDDING_DIMENSIONS - values.length).fill(0)];
}

/**
 * Embed a single text string.
 */
export async function embedText(
  text: string,
  options?: { apiKey?: string; model?: string },
): Promise<number[]> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  const client = getClient(options?.apiKey);
  const model = options?.model ?? getEmbeddingModel();
  const response = await client.embeddings.create({
    model,
    input: trimmed,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Embedding API returned no vector.");
  }
  return normalizeEmbedding(embedding);
}

/**
 * Embed many texts in batches (preserves input order).
 */
export async function embedTexts(
  texts: string[],
  options?: { apiKey?: string; model?: string },
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getClient(options?.apiKey);
  const model = options?.model ?? getEmbeddingModel();
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH).map((text) => {
      const trimmed = text.replace(/\s+/g, " ").trim();
      return trimmed.length > 0 ? trimmed : " ";
    });

    const response = await client.embeddings.create({
      model,
      input: batch,
    });

    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) {
      out.push(normalizeEmbedding(item.embedding));
    }
  }

  return out;
}

export const DEFAULT_OPENAI_EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL;
