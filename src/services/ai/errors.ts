/**
 * Safe application-level errors for API routes and AI services.
 * Never include secrets, prompts, or stack traces in `message`.
 */

export type AiErrorCode =
  | "INVALID_INPUT"
  | "MISSING_API_KEY"
  | "INVALID_MODEL_CONFIG"
  | "MALFORMED_MODEL_OUTPUT"
  | "EMPTY_MODEL_OUTPUT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "UPSTREAM_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;

  constructor(code: AiErrorCode, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
