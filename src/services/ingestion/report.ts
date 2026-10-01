import type { IngestionSummary } from "@/services/ingestion/types";

export function printIngestionSummary(summary: IngestionSummary): void {
  console.log("");
  console.log("Documents:");
  console.log(summary.documents);
  console.log("");
  console.log("Pages processed:");
  console.log(summary.pagesProcessed);
  console.log("");
  console.log("Questions detected:");
  console.log(summary.questionsDetected);
  console.log("");
  console.log("Valid records:");
  console.log(summary.validRecords);
  console.log("");
  console.log("Invalid records:");
  console.log(summary.invalidRecords);
  console.log("");
  console.log("Duplicates:");
  console.log(summary.duplicates);
  console.log("");
  console.log(summary.dryRun ? "Records to insert:" : "Records inserted:");
  console.log(
    summary.dryRun ? summary.recordsToInsert : summary.recordsInserted,
  );

  if (summary.invalidDetails.length > 0) {
    console.log("");
    console.log("Invalid record details:");
    for (const item of summary.invalidDetails) {
      console.log(
        `- [${item.sourceDocument}${item.sourcePage ? ` p.${item.sourcePage}` : ""}] ${item.reason}`,
      );
      if (item.question) {
        console.log(`  Q: ${item.question.slice(0, 120)}`);
      }
    }
  }

  if (summary.duplicateQuestions.length > 0) {
    console.log("");
    console.log("Duplicate questions (skipped):");
    for (const question of summary.duplicateQuestions) {
      console.log(`- ${question.slice(0, 120)}`);
    }
  }

  if (summary.issues.length > 0) {
    console.log("");
    console.log("Parser issues:");
    for (const issue of summary.issues) {
      console.log(
        `- [${issue.sourceDocument}${issue.sourcePage ? ` p.${issue.sourcePage}` : ""}] ${issue.message}`,
      );
    }
  }

  console.log("");
}
