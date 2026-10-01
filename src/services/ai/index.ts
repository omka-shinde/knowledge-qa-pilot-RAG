/**
 * AI services — Haiku (query understanding) + Sonnet (answer generation).
 */

export { processQuestion } from "@/services/ai/haiku";
export type {
  ProcessQuestionOptions,
  QueryUnderstandingResult,
} from "@/services/ai/haiku";
export { generateAnswer } from "@/services/ai/sonnet";
export type {
  AnswerGenerationResult,
  GenerateAnswerInput,
  GenerateAnswerOptions,
} from "@/services/ai/sonnet";
export { AppError, isAppError } from "@/services/ai/errors";
export type { AiErrorCode } from "@/services/ai/errors";
export {
  MAX_CONTEXT_TEXT_LENGTH,
  MAX_QUESTION_LENGTH,
  validateAnswerGenerationInput,
  validateAnswerGenerationOutput,
  validateQuestionInput,
  validateQueryUnderstandingOutput,
} from "@/services/ai/validation";
