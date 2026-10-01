import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "@/services/ai/errors";
import { askQuestion } from "./pipeline";
import type { CachedAskPayload } from "./cache";

const noopCache = {
  getCachedAsk: async () => null,
  setCachedAsk: async () => {},
};

describe("askQuestion pipeline", () => {
  it("runs Haiku → search → context → Sonnet and returns an answer", async () => {
    const stored: { value: CachedAskPayload | null } = { value: null };

    const result = await askQuestion("What is the recommended spacing?", {
      ...noopCache,
      setCachedAsk: async (_question, payload) => {
        stored.value = payload;
      },
      processQuestion: async () => ({
        intent: "spacing_guidance",
        searchQuery: "pomegranate plantation spacing",
      }),
      searchKnowledge: async () => ({
        searchQuery: "pomegranate plantation spacing",
        count: 1,
        results: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            question: "What is the recommended spacing for pomegranate plantation?",
            answer: "Spacing of 4.5 m x 3 m is recommended.",
            category: null,
            sourceDocument: "FAQs.pdf",
            sourcePage: 1,
            rank: 0.2,
          },
        ],
      }),
      buildContext: (input) => ({
        intent: "spacing_guidance",
        searchQuery: "pomegranate plantation spacing",
        contextText: "Knowledge base excerpts:\nAnswer: 4.5 m x 3 m.",
        excerpts: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            question: "What is the recommended spacing for pomegranate plantation?",
            answer: "Spacing of 4.5 m x 3 m is recommended.",
            category: null,
            sourceDocument: "FAQs.pdf",
            sourcePage: 1,
            rank: 0.2,
            estimatedTokens: 20,
          },
        ],
        includedCount: Array.isArray(input.results) ? input.results.length : 0,
        omittedCount: 0,
        estimatedTokens: 40,
        maxTokens: 3000,
      }),
      generateAnswer: async () => ({
        answer: "The recommended spacing is 4.5 m x 3 m.",
      }),
    });

    assert.equal(result.answer, "The recommended spacing is 4.5 m x 3 m.");
    assert.equal(result.intent, "spacing_guidance");
    assert.equal(result.searchQuery, "pomegranate plantation spacing");
    assert.equal(result.resultCount, 1);
    assert.equal(result.includedCount, 1);
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0]?.sourceDocument, "FAQs.pdf");
    assert.equal(result.cached, false);
    assert.equal(stored.value?.answer, "The recommended spacing is 4.5 m x 3 m.");
  });

  it("returns a cached answer without calling AI or search", async () => {
    let processCalled = false;
    let searchCalled = false;
    let generateCalled = false;

    const result = await askQuestion("What is the recommended spacing?", {
      getCachedAsk: async () => ({
        answer: "The recommended spacing is 4.5 m x 3 m.",
        intent: "spacing_guidance",
        searchQuery: "pomegranate plantation spacing",
        resultCount: 1,
        includedCount: 1,
        sources: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            question: "What is the recommended spacing for pomegranate plantation?",
            sourceDocument: "FAQs.pdf",
            sourcePage: 1,
          },
        ],
      }),
      setCachedAsk: async () => {
        throw new Error("should not store on cache hit");
      },
      processQuestion: async () => {
        processCalled = true;
        return { intent: "x", searchQuery: "x" };
      },
      searchKnowledge: async () => {
        searchCalled = true;
        return { searchQuery: "x", count: 0, results: [] };
      },
      generateAnswer: async () => {
        generateCalled = true;
        return { answer: "fresh" };
      },
    });

    assert.equal(result.cached, true);
    assert.equal(result.answer, "The recommended spacing is 4.5 m x 3 m.");
    assert.equal(processCalled, false);
    assert.equal(searchCalled, false);
    assert.equal(generateCalled, false);
  });

  it("rejects empty questions before calling downstream services", async () => {
    let searchCalled = false;

    await assert.rejects(
      () =>
        askQuestion("   ", {
          ...noopCache,
          processQuestion: async () => {
            throw new Error("should not run");
          },
          searchKnowledge: async () => {
            searchCalled = true;
            return { searchQuery: "x", count: 0, results: [] };
          },
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );

    assert.equal(searchCalled, false);
  });

  it("propagates AppErrors from intermediate stages", async () => {
    await assert.rejects(
      () =>
        askQuestion("What about soil?", {
          ...noopCache,
          processQuestion: async () => ({
            intent: "soil",
            searchQuery: "black cotton soil",
          }),
          searchKnowledge: async () => {
            throw new AppError(
              "DATABASE_ERROR",
              "Knowledge search is temporarily unavailable.",
              503,
            );
          },
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "DATABASE_ERROR",
    );
  });

  it("still answers when search returns no hits", async () => {
    const result = await askQuestion("Unknown topic?", {
      ...noopCache,
      processQuestion: async () => ({
        intent: "unknown",
        searchQuery: "unknown topic",
      }),
      searchKnowledge: async () => ({
        searchQuery: "unknown topic",
        count: 0,
        results: [],
      }),
      buildContext: () => ({
        intent: "unknown",
        searchQuery: "unknown topic",
        contextText: "Knowledge base excerpts:\n(no excerpts)",
        excerpts: [],
        includedCount: 0,
        omittedCount: 0,
        estimatedTokens: 10,
        maxTokens: 3000,
      }),
      generateAnswer: async () => ({
        answer:
          "The knowledge base does not contain enough information to answer this question.",
      }),
    });

    assert.match(result.answer, /does not contain enough information/i);
    assert.equal(result.resultCount, 0);
    assert.equal(result.sources.length, 0);
    assert.equal(result.cached, false);
  });
});
