import { AppError } from "@/services/ai/errors";

/** Default number of ranked knowledge hits to return. */
export const DEFAULT_SEARCH_LIMIT = 5;

/** Hard cap so callers cannot request unbounded result sets. */
export const MAX_SEARCH_LIMIT = 25;

/** Reasonable upper bound for a Haiku-produced search query. */
export const MAX_SEARCH_QUERY_LENGTH = 500;

export type SearchInput = {
  searchQuery: string;
  limit?: number;
};

export function validateSearchInput(input: {
  searchQuery?: unknown;
  limit?: unknown;
}): SearchInput {
  if (typeof input.searchQuery !== "string") {
    throw new AppError(
      "INVALID_INPUT",
      "searchQuery must be a string.",
      400,
    );
  }

  const searchQuery = input.searchQuery.trim();

  if (!searchQuery) {
    throw new AppError(
      "INVALID_INPUT",
      "searchQuery is required.",
      400,
    );
  }

  if (searchQuery.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new AppError(
      "INVALID_INPUT",
      `searchQuery must be at most ${MAX_SEARCH_QUERY_LENGTH} characters.`,
      400,
    );
  }

  let limit = DEFAULT_SEARCH_LIMIT;

  if (input.limit !== undefined) {
    if (
      typeof input.limit !== "number" ||
      !Number.isInteger(input.limit) ||
      input.limit < 1
    ) {
      throw new AppError(
        "INVALID_INPUT",
        "limit must be a positive integer.",
        400,
      );
    }
    if (input.limit > MAX_SEARCH_LIMIT) {
      throw new AppError(
        "INVALID_INPUT",
        `limit must be at most ${MAX_SEARCH_LIMIT}.`,
        400,
      );
    }
    limit = input.limit;
  }

  return { searchQuery, limit };
}
