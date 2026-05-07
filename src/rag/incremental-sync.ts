import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

import { settings } from "../config.js";
import { Embedder } from "./embedder.js";
import { VaultIndexer } from "./indexer.js";
import { buildNoteMetadata } from "./note-metadata.js";
import { type VectorStore } from "./vector-store.js";

type IndexState = {
  dirty: boolean;
  lastSyncAt: string | null;
  hashes: Record<string, string>;
};

type SyncResult = {
  mode: "sync_files" | "sync_if_dirty";
  dirtyBefore: boolean;
  indexed: number;
  skippedUnchanged: number;
  skippedEmpty: number;
  deleted: number;
  failed: number;
  dirtyAfter: boolean;
  lastSyncAt: string | null;
};

const STATE_DIR = ".obsidian-mcp";
const STATE_FILE = "index-state.json";

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

const hashContent = (content: string): string => createHash("sha256").update(content, "utf-8").digest("hex");

const normalizeRelPath = (path: string): string => path.trim().replace(/^\/+/, "");

const statePath = (): string => join(process.cwd(), STATE_DIR, STATE_FILE);

const defaultState = (): IndexState => ({
  dirty: false,
  lastSyncAt: null,
  hashes: {}
});

const readState = async (): Promise<IndexState> => {
  const raw = await readFile(statePath(), "utf-8").catch(() => "");
  if (!raw.trim()) {
    return defaultState();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<IndexState>;
    return {
      dirty: Boolean(parsed.dirty),
      lastSyncAt: typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : null,
      hashes: parsed.hashes && typeof parsed.hashes === "object" ? parsed.hashes as Record<string, string> : {}
    };
  } catch {
    return defaultState();
  }
};

const writeState = async (state: IndexState): Promise<void> => {
  await mkdir(join(process.cwd(), STATE_DIR), { recursive: true });
  await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
};

const syncInternal = async (paths: string[] | null, mode: SyncResult["mode"], store: VectorStore): Promise<SyncResult> => {
  const configuredVaultPath = settings.obsidianVaultRoot;
  const vaultPath = await resolveVaultPath(configuredVaultPath);
  if (!vaultPath) {
    throw new Error(`Vault path not found or invalid: ${configuredVaultPath}`);
  }

  const state = await readState();
  const dirtyBefore = state.dirty;
  if (mode === "sync_if_dirty" && !dirtyBefore) {
    return {
      mode,
      dirtyBefore,
      indexed: 0,
      skippedUnchanged: 0,
      skippedEmpty: 0,
      deleted: 0,
      failed: 0,
      dirtyAfter: false,
      lastSyncAt: state.lastSyncAt
    };
  }

  const embedder = new Embedder();
  const indexer = new VaultIndexer(embedder, store);

  const targetPaths = paths
    ? [...new Set(paths.map(normalizeRelPath).filter(Boolean))]
    : (await listMarkdownFiles(vaultPath)).map((file) => relative(vaultPath, file));

  let indexed = 0;
  let skippedUnchanged = 0;
  let skippedEmpty = 0;
  let deleted = 0;
  let failed = 0;

  for (const relPath of targetPaths) {
    const absPath = join(vaultPath, relPath);
    const exists = await stat(absPath).then((item) => item.isFile()).catch(() => false);
    if (!exists) {
      await store.delete(relPath);
      delete state.hashes[relPath];
      deleted += 1;
      continue;
    }

    try {
      const content = await readFile(absPath, "utf-8");
      const fileStats = await stat(absPath);
      if (!content.trim()) {
        skippedEmpty += 1;
        continue;
      }

      const hash = hashContent(content);
      if (state.hashes[relPath] === hash) {
        skippedUnchanged += 1;
        continue;
      }

      await indexer.indexNote(
        relPath,
        content,
        buildNoteMetadata(relPath, content, { updatedAt: fileStats.mtime.toISOString() })
      );
      state.hashes[relPath] = hash;
      indexed += 1;
    } catch {
      failed += 1;
    }
  }

  state.dirty = false;
  state.lastSyncAt = new Date().toISOString();
  await writeState(state);

  return {
    mode,
    dirtyBefore,
    indexed,
    skippedUnchanged,
    skippedEmpty,
    deleted,
    failed,
    dirtyAfter: state.dirty,
    lastSyncAt: state.lastSyncAt
  };
};

export const markIndexDirty = async (): Promise<{ dirty: boolean; statePath: string }> => {
  const state = await readState();
  state.dirty = true;
  await writeState(state);
  return { dirty: true, statePath: statePath() };
};

export const syncIfDirty = async (store: VectorStore): Promise<SyncResult> => syncInternal(null, "sync_if_dirty", store);

export const syncFiles = async (paths: string[], store: VectorStore): Promise<SyncResult> =>
  syncInternal(paths, "sync_files", store);

export const resetIndexState = async (): Promise<{ removed: boolean; statePath: string }> => {
  const path = statePath();
  await rm(path, { force: true });
  return { removed: true, statePath: path };
};
