import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@/lib/db";
import { AppError } from "@/services/ai/errors";
import { searchKnowledge } from "./postgres";
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_QUERY_LENGTH,
  validateSearchInput,
} from "./validation";

function mockDb(rows: unknown[]): Db {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: async () => rows,
  };

  return {
    select: () => builder,
  } as unknown as Db;
}

describe("validateSearchInput", () => {
  it("accepts a valid search query and default limit", () => {
    assert.deepEqual(validateSearchInput({ searchQuery: "  pomegranate spacing  " }), {
      searchQuery: "pomegranate spacing",
      limit: DEFAULT_SEARCH_LIMIT,
    });
  });

  it("rejects empty searchQuery", () => {
    assert.throws(
      () => validateSearchInput({ searchQuery: "" }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects whitespace-only searchQuery", () => {
    assert.throws(
      () => validateSearchInput({ searchQuery: "  \n\t " }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects oversized searchQuery", () => {
    assert.throws(
      () =>
        validateSearchInput({
          searchQuery: "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1),
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects invalid limit values", () => {
    assert.throws(
      () => validateSearchInput({ searchQuery: "soil", limit: 0 }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
    assert.throws(
      () =>
        validateSearchInput({
          searchQuery: "soil",
          limit: MAX_SEARCH_LIMIT + 1,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });
});

describe("searchKnowledge", () => {
  it("returns ranked hits for a valid searchQuery", async () => {
    const result = await searchKnowledge("pomegranate spacing", {
      db: mockDb([
        {
          id: "11111111-1111-1111-1111-111111111111",
          question: "What is the recommended spacing for pomegranate plantation?",
          answer: "Spacing of 4.5 m X 3 m is recommended.",
          category: null,
          sourceDocument: "FAQs.pdf",
          sourcePage: 1,
          rank: 0.2,
        },
      ]),
    });

    assert.equal(result.searchQuery, "pomegranate spacing");
    assert.equal(result.count, 1);
    assert.equal(result.results[0]?.sourcePage, 1);
    assert.equal(result.results[0]?.rank, 0.2);
    assert.match(result.results[0]?.question ?? "", /spacing/i);
  });

  it("returns an empty result set when nothing matches", async () => {
    const result = await searchKnowledge("zzzz-no-match", {
      db: mockDb([]),
    });

    assert.deepEqual(result, {
      searchQuery: "zzzz-no-match",
      count: 0,
      results: [],
    });
  });

  it("rejects empty searchQuery before querying", async () => {
    await assert.rejects(
      () => searchKnowledge("   ", { db: mockDb([]) }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("maps unexpected database failures to DATABASE_ERROR", async () => {
    const failingDb = {
      select: () => {
        throw new Error("connection refused");
      },
    } as unknown as Db;

    await assert.rejects(
      () => searchKnowledge("black cotton soil", { db: failingDb }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "DATABASE_ERROR" &&
        !error.message.includes("connection refused"),
    );
  });

  it("coerces string ranks from the driver", async () => {
    const result = await searchKnowledge("fertilizer", {
      db: mockDb([
        {
          id: "22222222-2222-2222-2222-222222222222",
          question: "What is the proper method for fertilizer application?",
          answer: "Apply fertilizers in ring during rainy season.",
          category: "IV. SOIL AND NUTRITION",
          sourceDocument: "FAQs.pdf",
          sourcePage: 3,
          rank: "0.084",
        },
      ]),
    });

    assert.equal(result.results[0]?.rank, 0.084);
    assert.equal(result.results[0]?.category, "IV. SOIL AND NUTRITION");
  });
});
