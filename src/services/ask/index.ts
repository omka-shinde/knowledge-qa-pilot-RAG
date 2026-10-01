/**
 * End-to-end ask pipeline (Phase 7) with response caching.
 */

export {
  askQuestion,
  type AskPipelineDeps,
  type AskPipelineResult,
} from "@/services/ask/pipeline";

export {
  getCachedAsk,
  setCachedAsk,
  toCacheKey,
  type CachedAskPayload,
} from "@/services/ask/cache";
