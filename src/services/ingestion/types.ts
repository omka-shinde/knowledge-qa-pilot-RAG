/**
 * Shared types for the PDF → knowledge-base ingestion pipeline.
 */

export type ParsedKnowledgeRecord = {
  question: string;
  answer: string;
  category: string | null;
  sourceDocument: string;
  sourcePage: number | null;
};

export type ValidatedKnowledgeRecord = ParsedKnowledgeRecord & {
  searchableContent: string;
  questionNormalized: string;
};

export type InvalidKnowledgeRecord = {
  reason: string;
  question?: string;
  answer?: string;
  sourceDocument: string;
  sourcePage?: number | null;
};

export type ParseIssue = {
  message: string;
  sourceDocument: string;
  sourcePage?: number | null;
};

export type PdfParseResult = {
  sourceDocument: string;
  pageCount: number;
  records: ParsedKnowledgeRecord[];
  issues: ParseIssue[];
};

export type IngestionSummary = {
  documents: number;
  pagesProcessed: number;
  questionsDetected: number;
  validRecords: number;
  invalidRecords: number;
  duplicates: number;
  recordsToInsert: number;
  recordsInserted: number;
  dryRun: boolean;
  invalidDetails: InvalidKnowledgeRecord[];
  duplicateQuestions: string[];
  issues: ParseIssue[];
};
