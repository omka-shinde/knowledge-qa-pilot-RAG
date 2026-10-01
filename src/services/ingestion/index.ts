import { importKnowledgeRecords } from "@/services/ingestion/importer";
import { parsePdfs } from "@/services/ingestion/pdf-parser";
import { printIngestionSummary } from "@/services/ingestion/report";
import { validateKnowledgeRecords } from "@/services/ingestion/validator";
import type { IngestionSummary } from "@/services/ingestion/types";

export type RunIngestionOptions = {
  filePaths: string[];
  dryRun?: boolean;
  printSummary?: boolean;
};

/**
 * Orchestrates parse → validate → (optional) import.
 */
export async function runIngestion(
  options: RunIngestionOptions,
): Promise<IngestionSummary> {
  const dryRun = options.dryRun ?? false;
  const parsedResults = await parsePdfs(options.filePaths);

  const allRecords = parsedResults.flatMap((result) => result.records);
  const issues = parsedResults.flatMap((result) => result.issues);
  const pagesProcessed = parsedResults.reduce(
    (sum, result) => sum + result.pageCount,
    0,
  );

  const { valid, invalid, duplicates } = validateKnowledgeRecords(allRecords);

  let recordsInserted = 0;
  const duplicateQuestions = duplicates.map((record) => record.question);

  if (!dryRun) {
    const importResult = await importKnowledgeRecords(valid);
    recordsInserted = importResult.inserted;
    duplicateQuestions.push(...importResult.skippedExistingQuestions);
  }

  const summary: IngestionSummary = {
    documents: parsedResults.length,
    pagesProcessed,
    questionsDetected: allRecords.length,
    validRecords: valid.length,
    invalidRecords: invalid.length,
    duplicates: dryRun
      ? duplicates.length
      : duplicates.length + (valid.length - recordsInserted),
    recordsToInsert: valid.length,
    recordsInserted,
    dryRun,
    invalidDetails: invalid,
    duplicateQuestions,
    issues,
  };

  if (options.printSummary !== false) {
    printIngestionSummary(summary);
  }

  return summary;
}

export { parsePdf, parsePdfs } from "@/services/ingestion/pdf-parser";
export { validateKnowledgeRecords } from "@/services/ingestion/validator";
export { importKnowledgeRecords } from "@/services/ingestion/importer";
export { printIngestionSummary } from "@/services/ingestion/report";
