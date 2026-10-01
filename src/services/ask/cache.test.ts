import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCacheKey } from "./cache";

describe("ask cache key", () => {
  it("normalizes casing, punctuation, and whitespace for cache hits", () => {
    assert.equal(
      toCacheKey("What is spacing?"),
      toCacheKey("  what is spacing  "),
    );
    assert.equal(toCacheKey("What is spacing?"), "what is spacing");
  });
});
