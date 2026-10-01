/**
 * Extract plain text from uploaded PDF / DOCX / DOC / TXT / MD files.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".md",
  ".markdown",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const MIME_BY_EXT: Record<AllowedExtension, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  ".doc": ["application/msword", "application/octet-stream"],
  ".txt": ["text/plain", "application/octet-stream"],
  ".md": ["text/markdown", "text/plain", "application/octet-stream"],
  ".markdown": ["text/markdown", "text/plain", "application/octet-stream"],
};

let pdfWorkerReady = false;

/**
 * Point pdf.js at the real worker file under node_modules.
 * Next/Turbopack otherwise looks for pdf.worker.mjs inside `.next/.../chunks`.
 */
function ensurePdfWorker(): void {
  if (pdfWorkerReady) {
    return;
  }

  const candidates = [
    path.join(
      process.cwd(),
      "node_modules",
      "pdf-parse",
      "dist",
      "pdf-parse",
      "esm",
      "pdf.worker.mjs",
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "pdf-parse",
      "dist",
      "worker",
      "pdf.worker.mjs",
    ),
  ];

  const workerPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!workerPath) {
    throw new Error(
      "pdf.worker.mjs not found under node_modules/pdf-parse. Reinstall pdf-parse.",
    );
  }

  PDFParse.setWorker(pathToFileURL(workerPath).href);
  pdfWorkerReady = true;
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return filename.slice(idx).toLowerCase();
}

export function isAllowedUpload(filename: string, mimeType: string): boolean {
  const ext = getExtension(filename) as AllowedExtension;
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }
  const allowedMimes = MIME_BY_EXT[ext];
  // Browsers often send empty or generic mime — allow when extension is valid.
  if (!mimeType || mimeType === "application/octet-stream") {
    return true;
  }
  return allowedMimes.includes(mimeType);
}

async function extractPdf(buffer: Buffer): Promise<string> {
  ensurePdfWorker();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    return textResult.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

async function extractDoc(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody() ?? "";
}

function extractPlain(buffer: Buffer): string {
  return buffer.toString("utf8");
}

/**
 * Extract text for an allowed document type.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = getExtension(filename);

  switch (ext) {
    case ".pdf":
      return extractPdf(buffer);
    case ".docx":
      return extractDocx(buffer);
    case ".doc":
      return extractDoc(buffer);
    case ".txt":
    case ".md":
    case ".markdown":
      return extractPlain(buffer);
    default:
      throw new Error(
        `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      );
  }
}
