import type { KnowledgeSearchHit } from "@/services/search/postgres";
import {
  estimateTokens,
  validateContextBuilderInput,
  type ContextBuilderInput,
} from "@/services/context/validation";

export type ContextExcerpt = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sourceDocument: string;
  sourcePage: number | null;
  rank: number;
  estimatedTokens: number;
};

export type BuiltContext = {
  intent: string | null;
  searchQuery: string | null;
  contextText: string;
  excerpts: ContextExcerpt[];
  includedCount: number;
  omittedCount: number;
  estimatedTokens: number;
  maxTokens: number;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatExcerptBlock(hit: KnowledgeSearchHit, index: number): string {
  const sourceParts = [hit.sourceDocument];
  if (hit.sourcePage !== null) {
    sourceParts.push(`p.${hit.sourcePage}`);
  }
  if (hit.category) {
    sourceParts.push(hit.category);
  }

  return [
    `[${index}] Question: ${normalizeWhitespace(hit.question)}`,
    `Answer: ${normalizeWhitespace(hit.answer)}`,
    `Source: ${sourceParts.join(" | ")}`,
  ].join("\n");
}

function prepareHits(
  results: KnowledgeSearchHit[],
  minRank: number,
): { candidates: KnowledgeSearchHit[]; skippedEmptyOrLowRank: number } {
  const seen = new Set<string>();
  const candidates: KnowledgeSearchHit[] = [];
  let skippedEmptyOrLowRank = 0;

  // Preserve highest-rank-first order from Phase 4; re-sort defensively.
  const ordered = [...results].sort((a, b) => b.rank - a.rank);

  for (const hit of ordered) {
    const question = normalizeWhitespace(hit.question);
    const answer = normalizeWhitespace(hit.answer);

    if (!question || !answer) {
      skippedEmptyOrLowRank += 1;
      continue;
    }

    if (hit.rank < minRank) {
      skippedEmptyOrLowRank += 1;
      continue;
    }

    if (seen.has(hit.id)) {
      skippedEmptyOrLowRank += 1;
      continue;
    }

    seen.add(hit.id);
    candidates.push({
      ...hit,
      question,
      answer,
    });
  }

  return { candidates, skippedEmptyOrLowRank };
}

/**
 * Build a clean, token-bounded context string from Phase 4 search hits.
 *
 * Responsibilities:
 * - drop empty / duplicate / low-rank hits
 * - keep highest-ranked excerpts first
 * - enforce maxItems + maxTokens budgets
 * - format Q/A + source metadata for a future Sonnet prompt
 *
 * Does not call Haiku, PostgreSQL, or Sonnet.
 */
export function buildContext(rawInput: {
  results?: unknown;
  searchQuery?: unknown;
  intent?: unknown;
  maxTokens?: unknown;
  maxItems?: unknown;
  minRank?: unknown;
}): BuiltContext {
  const input: ContextBuilderInput = validateContextBuilderInput(rawInput);
  const maxTokens = input.maxTokens ?? 3_000;
  const maxItems = input.maxItems ?? 5;
  const minRank = input.minRank ?? 0;

  const { candidates, skippedEmptyOrLowRank } = prepareHits(
    input.results,
    minRank,
  );

  const excerpts: ContextExcerpt[] = [];
  const blocks: string[] = [];
  let usedTokens = 0;
  let omittedForBudget = 0;

  const headerLines: string[] = ["Knowledge base excerpts:"];
  if (input.intent) {
    headerLines.push(`Intent: ${input.intent}`);
  }
  if (input.searchQuery) {
    headerLines.push(`Search query: ${input.searchQuery}`);
  }
  headerLines.push("");

  const headerText = headerLines.join("\n");
  usedTokens += estimateTokens(headerText);

  for (const [index, hit] of candidates.entries()) {
    if (excerpts.length >= maxItems) {
      omittedForBudget += candidates.length - index;
      break;
    }

    const block = formatExcerptBlock(hit, excerpts.length + 1);
    const blockTokens = estimateTokens(block);
    const separatorTokens = blocks.length > 0 ? estimateTokens("\n\n") : 0;

    if (usedTokens + separatorTokens + blockTokens > maxTokens) {
      // If even the first excerpt cannot fit, include a truncated version.
      if (excerpts.length === 0) {
        const remainingChars = Math.max(80, (maxTokens - usedTokens) * 4);
        const truncatedAnswer =
          hit.answer.length > remainingChars
            ? `${hit.answer.slice(0, remainingChars - 1)}…`
            : hit.answer;
        const truncatedHit = { ...hit, answer: truncatedAnswer };
        const truncatedBlock = formatExcerptBlock(truncatedHit, 1);
        const truncatedTokens = estimateTokens(truncatedBlock);

        if (truncatedTokens <= maxTokens - usedTokens) {
          blocks.push(truncatedBlock);
          usedTokens += truncatedTokens;
          excerpts.push({
            id: truncatedHit.id,
            question: truncatedHit.question,
            answer: truncatedHit.answer,
            category: truncatedHit.category,
            sourceDocument: truncatedHit.sourceDocument,
            sourcePage: truncatedHit.sourcePage,
            rank: truncatedHit.rank,
            estimatedTokens: truncatedTokens,
          });
        }
      }

      omittedForBudget += candidates.length - index;
      break;
    }

    usedTokens += separatorTokens + blockTokens;
    blocks.push(block);
    excerpts.push({
      id: hit.id,
      question: hit.question,
      answer: hit.answer,
      category: hit.category,
      sourceDocument: hit.sourceDocument,
      sourcePage: hit.sourcePage,
      rank: hit.rank,
      estimatedTokens: blockTokens,
    });
  }

  const body = blocks.join("\n\n");
  const contextText =
    blocks.length > 0 ? `${headerText}${body}` : `${headerText}(no excerpts)`;

  return {
    intent: input.intent ?? null,
    searchQuery: input.searchQuery ?? null,
    contextText,
    excerpts,
    includedCount: excerpts.length,
    omittedCount: skippedEmptyOrLowRank + omittedForBudget,
    estimatedTokens: estimateTokens(contextText),
    maxTokens,
  };
}
