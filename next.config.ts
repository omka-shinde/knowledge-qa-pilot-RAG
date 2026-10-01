import type { NextConfig } from "next";
import path from "node:path";

/**
 * Production-oriented Next.js config.
 * Railway provides PORT; `next start` respects it automatically.
 *
 * turbopack.root pins this folder so a parent git repo (e.g. home directory)
 * is not treated as the workspace root.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep PDF/Word parsers outside the Turbopack bundle so pdf.js can load its worker.
  serverExternalPackages: ["pdf-parse", "mammoth", "word-extractor"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
