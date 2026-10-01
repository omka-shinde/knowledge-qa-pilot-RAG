/**
 * PostgreSQL knowledge-base search (Phase 4).
 */

export {
  searchKnowledge,
  type KnowledgeSearchHit,
  type KnowledgeSearchResult,
  type SearchKnowledgeOptions,
} from "@/services/search/postgres";
export {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_QUERY_LENGTH,
  validateSearchInput,
  type SearchInput,
} from "@/services/search/validation";
