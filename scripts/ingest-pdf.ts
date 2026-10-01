import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { runIngestion } from "../src/services/ingestion";

loadEnv({ path: ".env.local" });
loadEnv();

function printUsage(): void {
  console.log(`Usage:
  npm run ingest:pdf -- [--dry-run] <pdf> [pdf...]
  npm run ingest:pdf -- [--dry-run] --all

Examples:
  npm run ingest:pdf -- --dry-run "./FAQs-in-English-इंग्रजी-8-12.pdf"
  npm run ingest:pdf -- --all
  npm run ingest:pdf -- --dry-run --all
`);
}

function resolvePdfArgs(argv: string[]): {
  dryRun: boolean;
  filePaths: string[];
} {
  const args = argv.slice(2);
  let dryRun = false;
  let all = false;
  const filePaths: string[] = [];

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    filePaths.push(arg);
  }

  if (all) {
    const rootPdfs = fs
      .readdirSync(process.cwd())
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .map((name) => path.resolve(process.cwd(), name));
    return { dryRun, filePaths: rootPdfs };
  }

  return {
    dryRun,
    filePaths: filePaths.map((filePath) => path.resolve(filePath)),
  };
}

async function main() {
  const { dryRun, filePaths } = resolvePdfArgs(process.argv);

  if (filePaths.length === 0) {
    printUsage();
    process.exit(1);
  }

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log("Mode: dry-run (no database writes)");
  } else if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Use --dry-run to preview extraction, or set DATABASE_URL in .env.local.",
    );
    process.exit(1);
  }

  const summary = await runIngestion({ filePaths, dryRun });

  if (summary.invalidRecords > 0) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
