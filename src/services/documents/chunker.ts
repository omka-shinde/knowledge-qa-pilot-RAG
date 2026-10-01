/**
 * Split plain text into overlapping chunks for embedding.
 */

export type TextChunk = {
  index: number;
  content: string;
  tokenEstimate: number;
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeForChunking(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Character-based chunker with overlap.
 * Prefers breaking on paragraph / sentence boundaries when close to the limit.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? 1200;
  const overlap = Math.min(options?.overlap ?? 200, Math.floor(chunkSize / 2));
  const cleaned = normalizeForChunking(text);

  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= chunkSize) {
    return [
      {
        index: 0,
        content: cleaned,
        tokenEstimate: estimateTokens(cleaned),
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const window = cleaned.slice(start, end);
      const paragraphBreak = window.lastIndexOf("\n\n");
      const sentenceBreak = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! "),
      );
      const softBreak =
        paragraphBreak >= chunkSize * 0.4
          ? paragraphBreak + 2
          : sentenceBreak >= chunkSize * 0.4
            ? sentenceBreak + 2
            : -1;

      if (softBreak > 0) {
        end = start + softBreak;
      }
    }

    const content = cleaned.slice(start, end).trim();
    if (content) {
      chunks.push({
        index,
        content,
        tokenEstimate: estimateTokens(content),
      });
      index += 1;
    }

    if (end >= cleaned.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks;
}
