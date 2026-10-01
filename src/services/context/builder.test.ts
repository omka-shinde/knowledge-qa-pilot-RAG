import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "@/services/ai/errors";
import type { KnowledgeSearchHit } from "@/services/search/postgres";
import { buildContext } from "./builder";
import {
  estimateTokens,
  validateContextBuilderInput,
} from "./validation";

function hit(
  overrides: Partial<KnowledgeSearchHit> & Pick<KnowledgeSearchHit, "id">,
): KnowledgeSearchHit {
  return {
    id: overrides.id,
    question: overrides.question ?? "What is spacing?",
    answer: overrides.answer ?? "Spacing of 4.5 m x 3 m is recommended.",
    category: overrides.category ?? null,
    sourceDocument: overrides.sourceDocument ?? "FAQs.pdf",
    sourcePage: overrides.sourcePage ?? 1,
    rank: overrides.rank ?? 0.2,
  };
}

describe("estimateTokens", () => {
  it("estimates tokens from character length", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("a".repeat(8)), 2);
  });
});

describe("validateContextBuilderInput", () => {
  it("accepts valid Phase 4 search hits", () => {
    const input = validateContextBuilderInput({
      results: [hit({ id: "a" })],
      searchQuery: " spacing ",
      intent: " planting ",
    });

    assert.equal(input.results.length, 1);
    assert.equal(input.searchQuery, "spacing");
    assert.equal(input.intent, "planting");
  });

  it("rejects non-array results", () => {
    assert.throws(
      () => validateContextBuilderInput({ results: "nope" }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects malformed hits", () => {
    assert.throws(
      () =>
        validateContextBuilderInput({
          results: [{ id: "x", question: "q" }],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });
});

describe("buildContext", () => {
  it("builds context text from ranked hits", () => {
    const result = buildContext({
      intent: "spacing_guidance",
      searchQuery: "pomegranate spacing",
      results: [
        hit({
          id: "1",
          question: "What is the recommended spacing?",
          answer: "4.5 m x 3 m.",
          rank: 0.3,
        }),
      ],
    });

    assert.equal(result.includedCount, 1);
    assert.equal(result.omittedCount, 0);
    assert.match(result.contextText, /Knowledge base excerpts/);
    assert.match(result.contextText, /Intent: spacing_guidance/);
    assert.match(result.contextText, /4\.5 m x 3 m/);
    assert.match(result.contextText, /Source: FAQs\.pdf/);
    assert.equal(result.excerpts[0]?.id, "1");
  });

  it("deduplicates by id and drops empty answers", () => {
    const result = buildContext({
      results: [
        hit({ id: "1", rank: 0.4 }),
        hit({ id: "1", rank: 0.3, answer: "duplicate" }),
        hit({ id: "2", question: "Q?", answer: "   ", rank: 0.2 }),
      ],
    });

    assert.equal(result.includedCount, 1);
    assert.equal(result.omittedCount, 2);
    assert.equal(result.excerpts[0]?.id, "1");
  });

  it("respects maxItems budget", () => {
    const result = buildContext({
      maxItems: 1,
      results: [
        hit({ id: "high", rank: 0.9, answer: "First answer." }),
        hit({ id: "low", rank: 0.1, answer: "Second answer." }),
      ],
    });

    assert.equal(result.includedCount, 1);
    assert.equal(result.excerpts[0]?.id, "high");
    assert.ok(result.omittedCount >= 1);
  });

  it("respects maxTokens budget and keeps higher-ranked hits", () => {
    const result = buildContext({
      maxTokens: 120,
      maxItems: 5,
      results: [
        hit({
          id: "short",
          rank: 0.9,
          question: "Short?",
          answer: "Yes.",
        }),
        hit({
          id: "long",
          rank: 0.1,
          question: "Long?",
          answer: "A".repeat(2_000),
        }),
      ],
    });

    assert.equal(result.excerpts[0]?.id, "short");
    assert.ok(result.estimatedTokens <= result.maxTokens);
    assert.ok(result.includedCount >= 1);
  });

  it("filters hits below minRank", () => {
    const result = buildContext({
      minRank: 0.15,
      results: [
        hit({ id: "keep", rank: 0.2 }),
        hit({ id: "drop", rank: 0.05 }),
      ],
    });

    assert.equal(result.includedCount, 1);
    assert.equal(result.excerpts[0]?.id, "keep");
    assert.equal(result.omittedCount, 1);
  });

  it("returns empty excerpts when no usable hits remain", () => {
    const result = buildContext({
      results: [hit({ id: "empty", answer: "  " })],
    });

    assert.equal(result.includedCount, 0);
    assert.match(result.contextText, /no excerpts/);
  });
});
