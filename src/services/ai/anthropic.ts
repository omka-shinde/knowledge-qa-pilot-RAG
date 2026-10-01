import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { AppError } from "@/services/ai/errors";

/**
 * Shared Anthropic client factory used by Haiku and Sonnet services.
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Map Anthropic SDK failures to safe application errors.
 */
export function mapAnthropicError(
  error: unknown,
  fallbackMessage: string,
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof AuthenticationError) {
    return new AppError(
      "AUTH_ERROR",
      "The AI service could not authenticate. Check server configuration.",
      502,
    );
  }

  if (error instanceof RateLimitError) {
    return new AppError(
      "RATE_LIMITED",
      "The AI service is temporarily rate-limited. Please try again shortly.",
      429,
    );
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AppError(
      "TIMEOUT",
      "The AI service timed out. Please try again.",
      504,
    );
  }

  if (error instanceof APIConnectionError) {
    return new AppError(
      "NETWORK_ERROR",
      "Unable to reach the AI service. Please try again.",
      503,
    );
  }

  if (error instanceof APIError) {
    const detail =
      typeof error.message === "string" ? error.message.toLowerCase() : "";

    if (!shouldSkipAiLogs()) {
      console.warn("[anthropic]", {
        status: error.status,
        message: error.message,
      });
    }

    if (
      detail.includes("credit balance is too low") ||
      detail.includes("purchase credits") ||
      detail.includes("plans & billing")
    ) {
      return new AppError(
        "UPSTREAM_ERROR",
        "Anthropic API credits are exhausted. Add credits in Plans & Billing, then try again.",
        502,
      );
    }

    return new AppError(
      "UPSTREAM_ERROR",
      "The AI service returned an error. Please try again.",
      502,
    );
  }

  return new AppError("UNKNOWN", fallbackMessage, 500);
}

export function shouldSkipAiLogs(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test"
  );
}
