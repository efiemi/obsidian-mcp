import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

import { settings } from "../src/config.js";
import { Embedder } from "../src/rag/embedder.js";
import { VaultIndexer } from "../src/rag/indexer.js";
import { createVectorStore } from "../src/rag/store-factory.js";

const listMarkdownFiles = async (basePath: string): Promise<string[]> => {
  const entries = await readdir(basePath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(basePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
};

const expandHome = (path: string): string => {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return path;
};

const resolveVaultPath = async (configuredPath: string): Promise<string | null> => {
  const normalized = expandHome(configuredPath.trim());
  const candidates = isAbsolute(normalized)
    ? [normalized]
    : [
        resolve(process.cwd(), normalized),
        resolve(homedir(), normalized),
        join(homedir(), "Obsidian", normalized),
        join(homedir(), "Documents", "Obsidian", normalized),
        join(homedir(), "Documentos", "Obsidian", normalized)
      ];

  for (const candidate of candidates) {
    const candidateStats = await stat(candidate).catch(() => null);
    if (candidateStats?.isDirectory()) {
      return candidate;
    }
  }

  return null;
};

const main = async (): Promise<void> => {
  const configuredVaultPath = settings.obsidianVaultRoot;
  const vaultPath = await resolveVaultPath(configuredVaultPath);

  if (!vaultPath) {
    throw new Error(`Vault path not found or invalid: ${configuredVaultPath}`);
  }

  const embedder = new Embedder();
  const store = createVectorStore();
  const indexer = new VaultIndexer(embedder, store);

  const files = await listMarkdownFiles(vaultPath);
  let indexedCount = 0;
  let skippedEmptyCount = 0;
  let failedCount = 0;
  const continueOnError = process.argv.includes("--continue-on-error");

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const relPath = relative(vaultPath, filePath);

    if (!content.trim()) {
      skippedEmptyCount += 1;
      continue;
    }

    try {
      await indexer.indexNote(relPath, content, { type: "note" });
      indexedCount += 1;
    } catch (error: unknown) {
      failedCount += 1;
      if (!continueOnError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Failed indexing "${relPath}": ${message}`);
    }
  }

  // Keep output simple for automation.
  console.log(
    `Indexed ${indexedCount} markdown files (skipped empty: ${skippedEmptyCount}, failed: ${failedCount}, continueOnError: ${continueOnError})`
  );
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected ingest error";
  console.error(message);
  process.exitCode = 1;
});
