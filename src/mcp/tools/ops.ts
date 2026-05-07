import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { syncFiles, syncIfDirty, markIndexDirty, resetIndexState } from "../../rag/incremental-sync.js";
import { type VectorStore } from "../../rag/vector-store.js";

const execFileAsync = promisify(execFile);

export const runIngest = async () => {
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["./scripts/ingest-with-nvm.sh"], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      command: "bash ./scripts/ingest-with-nvm.sh",
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error: unknown) {
    const withStreams = error as { stdout?: string; stderr?: string; message?: string };
    const stdout = typeof withStreams.stdout === "string" ? withStreams.stdout.trim() : "";
    const stderr = typeof withStreams.stderr === "string" ? withStreams.stderr.trim() : "";
    const message = withStreams.message ?? "Ingest command failed";
    throw new Error(`${message}${stderr ? ` | stderr: ${stderr}` : ""}${stdout ? ` | stdout: ${stdout}` : ""}`);
  }
};

export const markDirty = async () => markIndexDirty();

export const runSyncIfDirty = async (store: VectorStore) => syncIfDirty(store);

export const runSyncFiles = async (paths: string[], store: VectorStore) => syncFiles(paths, store);

export const clearSyncState = async () => resetIndexState();
