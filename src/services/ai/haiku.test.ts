import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { processQuestion } from "./haiku";
import { AppError } from "./errors";
import {
  MAX_QUESTION_LENGTH,
  validateQuestionInput,
  validateQueryUnderstandingOutput,
} from "./validation";

function mockClient(parsedOutput: unknown): Anthropic {
  return {
    messages: {
      parse: async () => ({ parsed_output: parsedOutput }),
    },
  } as unknown as Anthropic;
}

function mockClientThatThrows(error: unknown): Anthropic {
  return {
    messages: {
      parse: async () => {
        throw error;
      },
    },
  } as unknown as Anthropic;
}

describe("validateQuestionInput", () => {
  it("accepts a valid question", () => {
    assert.equal(
      validateQuestionInput("  How long is the return period?  "),
      "How long is the return period?",
    );
  });

  it("rejects empty question", () => {
    assert.throws(
      () => validateQuestionInput(""),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects whitespace-only question", () => {
    assert.throws(
      () => validateQuestionInput("   \n\t  "),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects very long question", () => {
    assert.throws(
      () => validateQuestionInput("a".repeat(MAX_QUESTION_LENGTH + 1)),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });
});

describe("validateQueryUnderstandingOutput", () => {
  it("accepts a valid structured response", () => {
    assert.deepEqual(
      validateQueryUnderstandingOutput({
        intent: " return_policy ",
        searchQuery: " product return period ",
      }),
      {
        intent: "return_policy",
        searchQuery: "product return period",
      },
    );
  });

  it("rejects malformed model response", () => {
    assert.throws(
      () => validateQueryUnderstandingOutput({ intent: 1, searchQuery: "x" }),
      (error: unknown) =>
        error instanceof AppError && error.code === "MALFORMED_MODEL_OUTPUT",
    );
  });

  it("rejects empty model response", () => {
    assert.throws(
      () => validateQueryUnderstandingOutput(null),
      (error: unknown) =>
        error instanceof AppError && error.code === "EMPTY_MODEL_OUTPUT",
    );
  });

  it("rejects incomplete fields", () => {
    assert.throws(
      () =>
        validateQueryUnderstandingOutput({
          intent: "return_policy",
          searchQuery: "   ",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "MALFORMED_MODEL_OUTPUT",
    );
  });
});

describe("processQuestion", () => {
  it("returns structured output for a valid question", async () => {
    const result = await processQuestion(
      "How long do I have to return my product?",
      {
        client: mockClient({
          intent: "return_policy",
          searchQuery: "product return period",
        }),
        apiKey: "test-key",
      },
    );

    assert.deepEqual(result, {
      intent: "return_policy",
      searchQuery: "product return period",
    });
  });

  it("handles a conversational question via Haiku output", async () => {
    const result = await processQuestion(
      "Hey, can you tell me how long I have to return something I bought?",
      {
        client: mockClient({
          intent: "return_policy",
          searchQuery: "return period purchased product",
        }),
        apiKey: "test-key",
      },
    );

    assert.equal(result.intent, "return_policy");
    assert.match(result.searchQuery, /return/i);
  });

  it("rejects empty question before calling the model", async () => {
    await assert.rejects(
      () =>
        processQuestion("   ", {
          client: mockClient({ intent: "x", searchQuery: "y" }),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects whitespace-only question", async () => {
    await assert.rejects(
      () =>
        processQuestion("\n\t", {
          client: mockClient({ intent: "x", searchQuery: "y" }),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects very long question", async () => {
    await assert.rejects(
      () =>
        processQuestion("q".repeat(MAX_QUESTION_LENGTH + 1), {
          client: mockClient({ intent: "x", searchQuery: "y" }),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects malformed model responses", async () => {
    await assert.rejects(
      () =>
        processQuestion("What payment methods do you accept?", {
          client: mockClient({ foo: "bar" }),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "MALFORMED_MODEL_OUTPUT",
    );
  });

  it("rejects empty model responses", async () => {
    await assert.rejects(
      () =>
        processQuestion("What payment methods do you accept?", {
          client: mockClient(null),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "EMPTY_MODEL_OUTPUT",
    );
  });

  it("maps Anthropic API errors safely", async () => {
    await assert.rejects(
      () =>
        processQuestion("What is spacing?", {
          client: mockClientThatThrows(
            new AuthenticationError(
              401,
              { type: "error", error: { type: "authentication_error", message: "bad" } },
              "Unauthorized",
              new Headers(),
            ),
          ),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "AUTH_ERROR" &&
        !error.message.includes("bad"),
    );
  });

  it("fails when API key is missing and no client is injected", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await assert.rejects(
        () => processQuestion("What is spacing?"),
        (error: unknown) =>
          error instanceof AppError && error.code === "MISSING_API_KEY",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previous;
      }
    }
  });

  it("maps rate-limit failures", async () => {
    await assert.rejects(
      () =>
        processQuestion("What is spacing?", {
          client: mockClientThatThrows(
            new RateLimitError(
              429,
              { type: "error", error: { type: "rate_limit_error", message: "slow down" } },
              "Too Many Requests",
              new Headers(),
            ),
          ),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "RATE_LIMITED",
    );
  });

  it("maps timeout and network failures", async () => {
    await assert.rejects(
      () =>
        processQuestion("What is spacing?", {
          client: mockClientThatThrows(new APIConnectionTimeoutError()),
          apiKey: "test-key",
        }),
      (error: unknown) => error instanceof AppError && error.code === "TIMEOUT",
    );

    await assert.rejects(
      () =>
        processQuestion("What is spacing?", {
          client: mockClientThatThrows(
            new APIConnectionError({ message: "offline" }),
          ),
          apiKey: "test-key",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "NETWORK_ERROR",
    );
  });
});

describe("optional live Anthropic integration", () => {
  const shouldRun =
    process.env.RUN_ANTHROPIC_INTEGRATION === "1" &&
    Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  it(
    "calls Haiku when RUN_ANTHROPIC_INTEGRATION=1 and API key is set",
    { skip: !shouldRun },
    async () => {
      const result = await processQuestion(
        "How long do I have to return my product?",
      );
      assert.ok(result.intent.length > 0);
      assert.ok(result.searchQuery.length > 0);
    },
  );
});
