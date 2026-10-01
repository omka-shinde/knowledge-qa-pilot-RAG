import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { AppError } from "./errors";
import { generateAnswer } from "./sonnet";
import {
  MAX_CONTEXT_TEXT_LENGTH,
  validateAnswerGenerationInput,
  validateAnswerGenerationOutput,
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

describe("validateAnswerGenerationInput", () => {
  it("accepts a valid question and contextText", () => {
    assert.deepEqual(
      validateAnswerGenerationInput({
        question: "  What is spacing?  ",
        contextText: "  Knowledge base excerpts:\nAnswer: 4.5 m  ",
        intent: " spacing ",
        searchQuery: " spacing query ",
      }),
      {
        question: "What is spacing?",
        contextText: "Knowledge base excerpts:\nAnswer: 4.5 m",
        intent: "spacing",
        searchQuery: "spacing query",
      },
    );
  });

  it("rejects empty contextText", () => {
    assert.throws(
      () =>
        validateAnswerGenerationInput({
          question: "What is spacing?",
          contextText: "   ",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects oversized contextText", () => {
    assert.throws(
      () =>
        validateAnswerGenerationInput({
          question: "What is spacing?",
          contextText: "a".repeat(MAX_CONTEXT_TEXT_LENGTH + 1),
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });
});

describe("validateAnswerGenerationOutput", () => {
  it("accepts a valid answer payload", () => {
    assert.deepEqual(
      validateAnswerGenerationOutput({ answer: "  Use 4.5 m spacing.  " }),
      { answer: "Use 4.5 m spacing." },
    );
  });

  it("rejects empty and malformed outputs", () => {
    assert.throws(
      () => validateAnswerGenerationOutput(null),
      (error: unknown) =>
        error instanceof AppError && error.code === "EMPTY_MODEL_OUTPUT",
    );
    assert.throws(
      () => validateAnswerGenerationOutput({ answer: "   " }),
      (error: unknown) =>
        error instanceof AppError && error.code === "MALFORMED_MODEL_OUTPUT",
    );
    assert.throws(
      () => validateAnswerGenerationOutput({ text: "nope" }),
      (error: unknown) =>
        error instanceof AppError && error.code === "MALFORMED_MODEL_OUTPUT",
    );
  });
});

describe("generateAnswer", () => {
  it("returns a natural-language answer from Sonnet structured output", async () => {
    const result = await generateAnswer(
      {
        question: "What is the recommended spacing?",
        contextText:
          "Knowledge base excerpts:\n[1] Question: What is spacing?\nAnswer: 4.5 m x 3 m.",
        intent: "spacing_guidance",
        searchQuery: "pomegranate spacing",
      },
      {
        client: mockClient({
          answer: "The recommended spacing is 4.5 m x 3 m.",
        }),
        apiKey: "test-key",
      },
    );

    assert.equal(result.answer, "The recommended spacing is 4.5 m x 3 m.");
  });

  it("rejects empty question before calling the model", async () => {
    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "  ",
            contextText: "context",
          },
          {
            client: mockClient({ answer: "should not run" }),
            apiKey: "test-key",
          },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_INPUT",
    );
  });

  it("rejects empty model responses", async () => {
    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "What is spacing?",
            contextText: "context",
          },
          {
            client: mockClient(null),
            apiKey: "test-key",
          },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "EMPTY_MODEL_OUTPUT",
    );
  });

  it("fails when API key is missing and no client is injected", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await assert.rejects(
        () =>
          generateAnswer({
            question: "What is spacing?",
            contextText: "context",
          }),
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

  it("maps Anthropic failures safely", async () => {
    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "What is spacing?",
            contextText: "context",
          },
          {
            client: mockClientThatThrows(
              new AuthenticationError(
                401,
                {
                  type: "error",
                  error: { type: "authentication_error", message: "secret" },
                },
                "Unauthorized",
                new Headers(),
              ),
            ),
            apiKey: "test-key",
          },
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "AUTH_ERROR" &&
        !error.message.includes("secret"),
    );

    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "What is spacing?",
            contextText: "context",
          },
          {
            client: mockClientThatThrows(
              new RateLimitError(
                429,
                {
                  type: "error",
                  error: { type: "rate_limit_error", message: "slow" },
                },
                "Too Many Requests",
                new Headers(),
              ),
            ),
            apiKey: "test-key",
          },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "RATE_LIMITED",
    );

    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "What is spacing?",
            contextText: "context",
          },
          {
            client: mockClientThatThrows(new APIConnectionTimeoutError()),
            apiKey: "test-key",
          },
        ),
      (error: unknown) => error instanceof AppError && error.code === "TIMEOUT",
    );

    await assert.rejects(
      () =>
        generateAnswer(
          {
            question: "What is spacing?",
            contextText: "context",
          },
          {
            client: mockClientThatThrows(
              new APIConnectionError({ message: "offline" }),
            ),
            apiKey: "test-key",
          },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "NETWORK_ERROR",
    );
  });
});

describe("optional live Sonnet integration", () => {
  const shouldRun =
    process.env.RUN_ANTHROPIC_INTEGRATION === "1" &&
    Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  it(
    "calls Sonnet when RUN_ANTHROPIC_INTEGRATION=1 and API key is set",
    { skip: !shouldRun },
    async () => {
      const result = await generateAnswer({
        question: "What is the recommended spacing for pomegranate plantation?",
        contextText:
          "Knowledge base excerpts:\n[1] Question: What is the recommended spacing for pomegranate plantation?\nAnswer: Spacing of 4.5 m (15 ft.) X 3 m (10 ft.) which accommodates about 296 plants per acre is recommended.\nSource: FAQs.pdf | p.1",
        intent: "spacing_guidance",
        searchQuery: "pomegranate plantation spacing",
      });
      assert.ok(result.answer.length > 0);
    },
  );
});
