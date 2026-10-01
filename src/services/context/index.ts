/**
 * Context builder — filter search hits and manage token budget (Phase 5).
 */

export {
  buildContext,
  type BuiltContext,
  type ContextExcerpt,
} from "@/services/context/builder";
export {
  DEFAULT_CONTEXT_MAX_ITEMS,
  DEFAULT_CONTEXT_MAX_TOKENS,
  DEFAULT_MIN_RANK,
  estimateTokens,
  MAX_CONTEXT_MAX_ITEMS,
  MAX_CONTEXT_MAX_TOKENS,
  validateContextBuilderInput,
  type ContextBuilderInput,
} from "@/services/context/validation";
