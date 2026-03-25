import { Agent as HttpsAgent } from "node:https";
import { AxiosError, type AxiosInstance } from "axios";
import axios from "axios";

import { settings } from "../config.js";

export interface SearchResult {
  path: string;
  score: number;
  excerpt: string;
}

export class ObsidianClient {
  private readonly client: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {};
    if (settings.obsidianApiKey) {
      headers.Authorization = `Bearer ${settings.obsidianApiKey}`;
    }

    this.client = axios.create({
      baseURL: settings.obsidianBaseUrl,
      headers,
      timeout: 20_000,
      httpsAgent: new HttpsAgent({ rejectUnauthorized: false }),
      validateStatus: (status) => status >= 200 && status < 300
    });
  }

  async readNote(path: string): Promise<string> {
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const response = await this.client.get<string>(`/vault/${encodedPath}`, {
      responseType: "text"
    });
    return response.data;
  }

  async writeNote(path: string, content: string): Promise<void> {
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
    await this.client.put(`/vault/${encodedPath}`, content, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" }
    });
  }

  async listNotes(): Promise<string[]> {
    const response = await this.client.get<unknown>("/vault/");
    return this.extractFileList(response.data);
  }

  private async listDirectory(directory = ""): Promise<string[]> {
    const normalized = directory.trim().replace(/^\/+|\/+$/g, "");
    const endpoint = normalized
      ? `/vault/${encodeURIComponent(normalized).replace(/%2F/g, "/")}/`
      : "/vault/";

    const response = await this.client.get<unknown>(endpoint);
    return this.extractFileList(response.data);
  }

  private extractFileList(payload: unknown): string[] {
    if (Array.isArray(payload)) {
      return payload.map(String);
    }

    if (payload && typeof payload === "object" && "files" in payload) {
      const files = (payload as { files?: unknown }).files;
      if (Array.isArray(files)) {
        return files.map(String);
      }
    }

    return [];
  }

  async walkTree(directory = ""): Promise<{ files: string[]; folders: string[] }> {
    const start = directory.trim().replace(/^\/+|\/+$/g, "");
    const stack: string[] = [start];
    const files: string[] = [];
    const folders = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop() ?? "";
      const entries = await this.listDirectory(current);

      for (const entry of entries) {
        const joined = current ? `${current}/${entry}` : entry;
        const normalized = joined.replace(/^\/+/, "");

        if (normalized.endsWith("/")) {
          const folder = normalized.replace(/\/+$/, "");
          folders.add(folder);
          stack.push(folder);
        } else {
          files.push(normalized);
        }
      }
    }

    return { files, folders: [...folders] };
  }

  private static buildExcerpt(content: string, query: string, window = 160): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const start = lowerContent.indexOf(lowerQuery);

    if (start < 0) {
      return content.slice(0, window);
    }

    return content.slice(start, start + window);
  }

  async searchNotes(query: string): Promise<SearchResult[]> {
    try {
      const response = await this.client.post<unknown>("/search/simple/", { query }, { timeout: 3_000 });
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload as SearchResult[];
      }

      if (payload && typeof payload === "object" && "results" in payload) {
        const results = (payload as { results?: unknown }).results;
        if (Array.isArray(results)) {
          return results as SearchResult[];
        }
      }
    } catch (error) {
      if (!(error instanceof AxiosError)) {
        throw error;
      }
    }

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const path of (await this.walkTree()).files) {
      if (!path.toLowerCase().endsWith(".md")) {
        continue;
      }

      const content = await this.readNote(path);
      if (path.toLowerCase().includes(lowerQuery) || content.toLowerCase().includes(lowerQuery)) {
        results.push({
          path,
          score: 1,
          excerpt: ObsidianClient.buildExcerpt(content, query)
        });
      }
    }

    return results;
  }
}
