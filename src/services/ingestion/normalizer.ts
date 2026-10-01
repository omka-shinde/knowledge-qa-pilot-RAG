/**
 * Normalize extracted FAQ text for storage and duplicate detection.
 * Does not paraphrase answers — only cleans extraction artifacts.
 */

const QUESTION_NUMBER_LINE = /^Q\d+\.?\s*$/i;
const BARE_PAGE_NUMBER = /^\d{1,3}$/;
const PDF_PAGE_MARKER = /^--\s*\d+\s+of\s+\d+\s*--$/i;
const SECTION_HEADING = /^([IVXLCDM]+)\.\s+(.+)$/i;

export function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (QUESTION_NUMBER_LINE.test(trimmed)) {
    return true;
  }
  if (BARE_PAGE_NUMBER.test(trimmed)) {
    return true;
  }
  if (PDF_PAGE_MARKER.test(trimmed)) {
    return true;
  }
  return false;
}

export function matchSectionHeading(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(SECTION_HEADING);
  if (!match) {
    return null;
  }
  return `${match[1].toUpperCase()}. ${match[2].trim()}`;
}

/** Collapse whitespace and trim; preserve wording. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Duplicate key: lowercase, collapsed whitespace, strip trailing punctuation.
 * Category is not part of the key — these FAQs are not repeated per section.
 */
export function normalizeQuestionKey(question: string): string {
  return normalizeWhitespace(question)
    .toLowerCase()
    .replace(/[?？]+$/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchableContent(question: string, answer: string): string {
  return `${normalizeWhitespace(question)} ${normalizeWhitespace(answer)}`.trim();
}
