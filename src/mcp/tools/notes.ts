import { AxiosError } from "axios";
import { createHash } from "node:crypto";

import { settings } from "../../config.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { Embedder } from "../../rag/embedder.js";

const normalize = (path: string): string => path.trim().replace(/^\/+/, "");
const normalizeFolder = (path: string): string => path.trim().replace(/^\/+|\/+$/g, "");

const normalizeRoot = (): string => settings.obsidianVaultRoot.trim().replace(/^\/+|\/+$/g, "");

const validatePath = (path: string): void => {
  const normalized = normalize(path);
  if (normalized.split("/").includes("..")) {
    throw new Error("Path traversal is not allowed");
  }
};

const toVaultPath = (path: string): string => {
  validatePath(path);
  const root = normalizeRoot();
  const normalized = normalize(path);

  if (!normalized) {
    return root;
  }

  if (!root) {
    return normalized;
  }

  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }

  return `${root}/${normalized}`;
};

const candidateVaultPaths = (path: string): string[] => {
  const preferred = toVaultPath(path);
  const normalized = normalize(path);
  return [...new Set(preferred === normalized ? [preferred] : [preferred, normalized])];
};

const toVaultFolderPath = (path: string): string => {
  validatePath(path);
  const root = normalizeRoot();
  const normalized = normalizeFolder(path);

  if (!normalized) {
    return root;
  }

  if (!root) {
    return normalized;
  }

  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }

  return `${root}/${normalized}`;
};

const candidateVaultFolders = (path: string): string[] => {
  const preferred = toVaultFolderPath(path);
  const normalized = normalizeFolder(path);
  return [...new Set(preferred === normalized ? [preferred] : [preferred, normalized])];
};

const validateWrite = (path: string): void => {
  const normalized = normalize(path);
  if (settings.blockedOverwritePrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("Writing this path is blocked");
  }
};

const NOTE_TEMPLATES: Record<string, string> = {
  architecture: `# {{title}}

## Context
{{context}}

## Architecture
{{architecture}}

## Decisions
{{decisions}}

## Risks
{{risks}}

## Next Steps
{{next_steps}}
`,
  adr: `# ADR {{id}} - {{title}}

Status: {{status}}
Date: {{date}}

## Context
{{context}}

## Decision
{{decision}}

## Consequences
{{consequences}}

## Alternatives Considered
{{alternatives}}
`,
  meeting: `# Meeting - {{title}}

Date: {{date}}
Participants: {{participants}}

## Agenda
{{agenda}}

## Notes
{{notes}}

## Decisions
{{decisions}}

## Action Items
{{action_items}}
`,
  "decision-log": `# Decision Log - {{title}}

## Summary
{{summary}}

## Decision
{{decision}}

## Rationale
{{rationale}}

## Impact
{{impact}}

## Follow-up
{{follow_up}}
`
};

const isHttp404 = (error: unknown): boolean => {
  return error instanceof AxiosError && error.response?.status === 404;
};

const stripConfiguredRoot = (path: string): string => {
  const normalized = normalizeFolder(path);
  const root = normalizeRoot();

  if (!root) {
    return normalized;
  }

  if (normalized === root) {
    return "";
  }

  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }

  return normalized;
};

const withoutMdExtension = (path: string): string => path.replace(/\.md$/i, "");

const parseFrontmatter = (content: string): Record<string, unknown> => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m.exec(content);
  if (!match) {
    return {};
  }

  const record: Record<string, unknown> = {};
  const lines = match[1].split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    record[key] = value;
  }

  return record;
};

const parseFrontmatterTags = (rawTags: unknown): string[] => {
  if (typeof rawTags !== "string") {
    return [];
  }

  const trimmed = rawTags.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .map((value) => value.replace(/^#/, ""))
      .filter(Boolean);
  }

  return trimmed
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .map((value) => value.replace(/^#/, ""))
    .filter(Boolean);
};

const parseInlineTags = (content: string): string[] => {
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");
  const tags = new Set<string>();
  const tagRegex = /(^|\s)#([a-zA-Z0-9/_-]+)/g;

  for (const match of withoutCodeBlocks.matchAll(tagRegex)) {
    const value = match[2]?.trim();
    if (value) {
      tags.add(value);
    }
  }

  return [...tags];
};

const extractWikiTargets = (content: string): string[] => {
  const targets = new Set<string>();
  const wikiRegex = /\[\[([^\]]+)\]\]/g;

  for (const match of content.matchAll(wikiRegex)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    const withoutAlias = raw.split("|")[0]?.trim() ?? "";
    const withoutHeading = withoutAlias.split("#")[0]?.trim() ?? "";
    if (withoutHeading) {
      targets.add(withoutMdExtension(withoutHeading).toLowerCase());
    }
  }

  return [...targets];
};

const extractOutgoingLinks = (content: string): string[] => {
  const links = new Set<string>();
  const wikiRegex = /\[\[([^\]]+)\]\]/g;

  for (const match of content.matchAll(wikiRegex)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    const withoutAlias = raw.split("|")[0]?.trim() ?? "";
    const withoutHeading = withoutAlias.split("#")[0]?.trim() ?? "";
    if (withoutHeading) {
      links.add(withoutHeading);
    }
  }

  return [...links];
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const clampTopK = (value: number | undefined, fallback = 8): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value ?? fallback);
  return Math.min(25, Math.max(1, rounded));
};

const dotProduct = (left: number[], right: number[]): number => {
  const size = Math.min(left.length, right.length);
  let total = 0;
  for (let i = 0; i < size; i += 1) {
    total += left[i] * right[i];
  }
  return total;
};

const GRAPH_CACHE_TTL_MS = 30_000;

type NoteGraphCacheEntry = {
  content: string;
  contentHash: string;
  outgoingTargets: string[];
  embedding?: number[];
  refreshedAt: number;
};

type NoteListCache = {
  notes: string[];
  refreshedAt: number;
};

const noteGraphCache = new Map<string, NoteGraphCacheEntry>();
let noteListCache: NoteListCache | null = null;

const invalidateGraphCaches = (path?: string): void => {
  noteListCache = null;
  if (!path) {
    noteGraphCache.clear();
    return;
  }

  const normalized = normalize(path);
  noteGraphCache.delete(normalized);
  noteGraphCache.delete(withoutMdExtension(normalized));
  noteGraphCache.delete(`${withoutMdExtension(normalized)}.md`);
};

const hashContent = (content: string): string =>
  createHash("sha256").update(content, "utf-8").digest("hex");

const isFresh = (refreshedAt: number): boolean => Date.now() - refreshedAt < GRAPH_CACHE_TTL_MS;

const getAllNotesCached = async (client: ObsidianClient): Promise<string[]> => {
  if (noteListCache && isFresh(noteListCache.refreshedAt)) {
    return noteListCache.notes;
  }

  const notes = await listNotes(client);
  noteListCache = { notes, refreshedAt: Date.now() };
  return notes;
};

const getOrReadNoteCache = async (
  client: ObsidianClient,
  path: string,
  options: { embedder?: Embedder; requireEmbedding?: boolean } = {}
): Promise<NoteGraphCacheEntry> => {
  const normalizedPath = normalize(path);
  const cached = noteGraphCache.get(normalizedPath);

  if (cached && isFresh(cached.refreshedAt)) {
    if (!options.requireEmbedding || cached.embedding) {
      return cached;
    }
  }

  const content = await readNote(client, normalizedPath);
  const contentHash = hashContent(content);
  const outgoingTargets = extractWikiTargets(content);

  let embedding = cached?.embedding;
  if (options.requireEmbedding) {
    if (!embedding || cached?.contentHash !== contentHash) {
      const embedder = options.embedder ?? new Embedder();
      embedding = await embedder.embedText(content);
    }
  } else if (cached?.contentHash !== contentHash) {
    embedding = undefined;
  }

  const nextValue: NoteGraphCacheEntry = {
    content,
    contentHash,
    outgoingTargets,
    embedding,
    refreshedAt: Date.now()
  };
  noteGraphCache.set(normalizedPath, nextValue);
  return nextValue;
};

const readNoteOrNull = async (client: ObsidianClient, path: string): Promise<string | null> => {
  try {
    return await readNote(client, path);
  } catch (error) {
    if (isHttp404(error)) {
      return null;
    }
    throw error;
  }
};

const ensureTrailingNewline = (content: string): string =>
  content.endsWith("\n") ? content : `${content}\n`;

const appendMarkdown = (base: string, extra: string): string => {
  const normalizedExtra = extra.trim();
  if (!base.trim()) {
    return ensureTrailingNewline(normalizedExtra);
  }

  const baseWithNewline = ensureTrailingNewline(base);
  const separator = baseWithNewline.endsWith("\n\n") ? "" : "\n";
  return ensureTrailingNewline(`${baseWithNewline}${separator}${normalizedExtra}`);
};

const normalizeHeading = (heading: string): { line: string; title: string; level: number | null } => {
  const trimmed = heading.trim();
  const match = /^(#{1,6})\s+(.+)$/.exec(trimmed);

  if (!match) {
    return {
      line: `## ${trimmed}`,
      title: trimmed.toLowerCase(),
      level: null
    };
  }

  return {
    line: `${match[1]} ${match[2].trim()}`,
    title: match[2].trim().toLowerCase(),
    level: match[1].length
  };
};

const updateMarkdownSection = (document: string, heading: string, content: string): string => {
  const normalizedDoc = document.replace(/\r\n/g, "\n");
  const lines = normalizedDoc.split("\n");
  const headingInfo = normalizeHeading(heading);
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  let headingIndex = -1;
  let effectiveLevel = headingInfo.level;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const match = headingRegex.exec(line);
    if (!match) {
      continue;
    }

    const lineLevel = match[1].length;
    const lineTitle = match[2].trim().toLowerCase();
    const fullHeadingMatches = line.toLowerCase() === heading.trim().toLowerCase();
    const titleMatches = lineTitle === headingInfo.title && (headingInfo.level === null || lineLevel === headingInfo.level);

    if (fullHeadingMatches || titleMatches) {
      headingIndex = index;
      if (effectiveLevel === null) {
        effectiveLevel = lineLevel;
      }
      break;
    }
  }

  const normalizedSectionContent = content.trim();
  if (headingIndex < 0) {
    const appended = appendMarkdown(
      normalizedDoc,
      `${headingInfo.line}\n\n${normalizedSectionContent}`.trim()
    );
    return appended;
  }

  const sectionStart = headingIndex + 1;
  let sectionEnd = lines.length;
  for (let index = sectionStart; index < lines.length; index += 1) {
    const match = headingRegex.exec(lines[index].trim());
    if (!match) {
      continue;
    }

    const level = match[1].length;
    if (effectiveLevel === null || level <= effectiveLevel) {
      sectionEnd = index;
      break;
    }
  }

  const replacementLines = normalizedSectionContent ? normalizedSectionContent.split("\n") : [];
  const nextLines = [...lines.slice(0, sectionStart), ...replacementLines, ...lines.slice(sectionEnd)];
  return ensureTrailingNewline(nextLines.join("\n").replace(/\n{3,}/g, "\n\n"));
};

const coerceTemplateData = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
};

const renderTemplate = (template: string, data: Record<string, unknown>): string => {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const path = key.split(".");
    let value: unknown = data;

    for (const part of path) {
      if (!value || typeof value !== "object" || Array.isArray(value) || !(part in value)) {
        return "";
      }
      value = (value as Record<string, unknown>)[part];
    }

    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  });
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "note";

const resolveTemplateTargetPath = (
  explicitPath: unknown,
  data: Record<string, unknown>,
  templateName: string
): string => {
  if (typeof explicitPath === "string" && explicitPath.trim()) {
    return normalize(explicitPath.trim());
  }

  const dataPath = data.path;
  if (typeof dataPath === "string" && dataPath.trim()) {
    return normalize(dataPath.trim());
  }

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : templateName;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `generated/${slugify(title)}-${stamp}.md`;
};

const computeBacklinks = async (client: ObsidianClient, path: string): Promise<string[]> => {
  const noteWithoutExtension = withoutMdExtension(normalize(path)).toLowerCase();
  const noteBaseName = noteWithoutExtension.split("/").pop() ?? noteWithoutExtension;
  const backlinks: string[] = [];

  for (const notePath of await getAllNotesCached(client)) {
    const comparablePath = normalize(notePath).toLowerCase();
    if (withoutMdExtension(comparablePath) === noteWithoutExtension) {
      continue;
    }

    try {
      const targets = (await getOrReadNoteCache(client, notePath)).outgoingTargets;
      if (targets.includes(noteWithoutExtension) || targets.includes(noteBaseName)) {
        backlinks.push(notePath);
      }
    } catch {
      // Ignore isolated read failures while computing backlinks.
    }
  }

  return uniqueSorted(backlinks);
};

export const readNote = async (client: ObsidianClient, path: string): Promise<string> => {
  let lastError: unknown;

  for (const candidate of candidateVaultPaths(path)) {
    try {
      return await client.readNote(candidate);
    } catch (error) {
      if (!isHttp404(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to read note");
};

export const writeNote = async (client: ObsidianClient, path: string, content: string): Promise<string> => {
  validatePath(path);
  validateWrite(path);

  let lastError: unknown;

  for (const candidate of candidateVaultPaths(path)) {
    try {
      await client.writeNote(candidate, content);
      invalidateGraphCaches(path);
      return "ok";
    } catch (error) {
      if (!isHttp404(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to write note");
};

export const appendToNote = async (
  client: ObsidianClient,
  path: string,
  content: string
): Promise<{ path: string; status: "appended" | "created" }> => {
  validatePath(path);
  validateWrite(path);

  const normalizedPath = normalize(path);
  const current = await readNoteOrNull(client, normalizedPath);
  const nextContent = appendMarkdown(current ?? "", content);
  await writeNote(client, normalizedPath, nextContent);
  return { path: normalizedPath, status: current === null ? "created" : "appended" };
};

export const updateSection = async (
  client: ObsidianClient,
  path: string,
  heading: string,
  content: string
): Promise<{ path: string; heading: string; action: "updated" | "created_note" }> => {
  validatePath(path);
  validateWrite(path);

  const normalizedPath = normalize(path);
  const current = await readNoteOrNull(client, normalizedPath);
  const base = current ?? "";
  const updated = updateMarkdownSection(base, heading, content);

  await writeNote(client, normalizedPath, updated);
  return {
    path: normalizedPath,
    heading: normalizeHeading(heading).line,
    action: current === null ? "created_note" : "updated"
  };
};

export const createNoteFromTemplate = async (
  client: ObsidianClient,
  templateName: string,
  data: unknown,
  path?: unknown
): Promise<{ path: string; template: string }> => {
  const normalizedTemplate = templateName.trim().toLowerCase();
  const template = NOTE_TEMPLATES[normalizedTemplate];
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const templateData = coerceTemplateData(data);
  const targetPath = resolveTemplateTargetPath(path, templateData, normalizedTemplate);
  validatePath(targetPath);
  validateWrite(targetPath);

  const existing = await readNoteOrNull(client, targetPath);
  if (existing !== null) {
    throw new Error(`Target note already exists: ${targetPath}`);
  }

  const rendered = ensureTrailingNewline(renderTemplate(template, templateData).trim());
  await writeNote(client, targetPath, rendered);
  return { path: targetPath, template: normalizedTemplate };
};

export const listNotes = async (client: ObsidianClient, path = ""): Promise<string[]> => {
  validatePath(path);
  let lastError: unknown;

  for (const candidate of candidateVaultFolders(path)) {
    try {
      const tree = await client.walkTree(candidate);
      const notes = tree.files
        .filter((item) => item.toLowerCase().endsWith(".md"))
        .map(stripConfiguredRoot)
        .filter((item) => item.length > 0 || path.trim().length === 0);
      return uniqueSorted(notes);
    } catch (error) {
      if (!isHttp404(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to list notes");
};

export const listFolders = async (client: ObsidianClient, path = ""): Promise<string[]> => {
  validatePath(path);
  let lastError: unknown;

  for (const candidate of candidateVaultFolders(path)) {
    try {
      const tree = await client.walkTree(candidate);
      return uniqueSorted(tree.folders.map(stripConfiguredRoot).filter((item) => item.length > 0));
    } catch (error) {
      if (!isHttp404(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to list folders");
};

export const getNoteMetadata = async (
  client: ObsidianClient,
  path: string
): Promise<{
  path: string;
  sizeBytes: number;
  tags: string[];
  createdAt: string | null;
  backlinks: string[];
}> => {
  validatePath(path);
  const content = await readNote(client, path);
  const normalizedPath = normalize(path);

  const frontmatter = parseFrontmatter(content);
  const createdValue =
    frontmatter.created ??
    frontmatter.created_at ??
    frontmatter.createdAt ??
    frontmatter.date ??
    null;
  const createdAt =
    typeof createdValue === "string" && createdValue.trim().length > 0 ? createdValue.trim() : null;

  const frontmatterTags = parseFrontmatterTags(frontmatter.tags);
  const inlineTags = parseInlineTags(content);
  const tags = uniqueSorted([...frontmatterTags, ...inlineTags]);

  return {
    path: normalizedPath,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    tags,
    createdAt,
    backlinks: await computeBacklinks(client, normalizedPath)
  };
};

export const getNoteLinks = async (
  client: ObsidianClient,
  path: string
): Promise<{
  path: string;
  outgoingLinks: string[];
  incomingLinks: string[];
}> => {
  validatePath(path);
  const content = await readNote(client, path);
  const normalizedPath = normalize(path);

  return {
    path: normalizedPath,
    outgoingLinks: uniqueSorted(extractOutgoingLinks(content)),
    incomingLinks: await computeBacklinks(client, normalizedPath)
  };
};

export const getBacklinks = async (
  client: ObsidianClient,
  path: string
): Promise<{ path: string; backlinks: string[] }> => {
  const normalizedPath = normalize(path);
  return {
    path: normalizedPath,
    backlinks: (await getNoteLinks(client, normalizedPath)).incomingLinks
  };
};

export const getOutgoingLinks = async (
  client: ObsidianClient,
  path: string
): Promise<{ path: string; outgoingLinks: string[] }> => {
  const normalizedPath = normalize(path);
  return {
    path: normalizedPath,
    outgoingLinks: (await getNoteLinks(client, normalizedPath)).outgoingLinks
  };
};

export const getGraphContext = async (
  client: ObsidianClient,
  path: string,
  topK?: number
): Promise<{
  path: string;
  relatedNotes: {
    path: string;
    source: "backlink" | "outgoing_link" | "semantic";
    score?: number;
  }[];
  semanticCluster: string[];
}> => {
  const normalizedPath = normalize(path);
  const embedder = new Embedder();
  const targetEntry = await getOrReadNoteCache(client, normalizedPath, {
    embedder,
    requireEmbedding: true
  });
  const links = await getNoteLinks(client, normalizedPath);

  const relatedByPath = new Map<string, { path: string; source: "backlink" | "outgoing_link" | "semantic"; score?: number }>();
  for (const backlink of links.incomingLinks) {
    relatedByPath.set(backlink, { path: backlink, source: "backlink" });
  }
  for (const outgoing of links.outgoingLinks) {
    if (!relatedByPath.has(outgoing)) {
      relatedByPath.set(outgoing, { path: outgoing, source: "outgoing_link" });
    }
  }

  const targetTopK = clampTopK(topK, 8);
  const candidateNotes = (await getAllNotesCached(client)).filter(
    (candidate) => withoutMdExtension(normalize(candidate)).toLowerCase() !== withoutMdExtension(normalizedPath).toLowerCase()
  );

  const referenceEmbedding = targetEntry.embedding ?? (await embedder.embedText(targetEntry.content));
  const scoredCandidates: { path: string; score: number }[] = [];

  for (const candidatePath of candidateNotes) {
    try {
      const entry = await getOrReadNoteCache(client, candidatePath, {
        embedder,
        requireEmbedding: true
      });
      const embedding = entry.embedding;
      if (!embedding) {
        continue;
      }
      scoredCandidates.push({
        path: candidatePath,
        score: dotProduct(referenceEmbedding, embedding)
      });
    } catch {
      // Ignore isolated semantic failures and keep graph context available.
    }
  }

  scoredCandidates.sort((left, right) => right.score - left.score);
  const semanticTop = scoredCandidates.slice(0, targetTopK);
  for (const candidate of semanticTop) {
    if (!relatedByPath.has(candidate.path)) {
      relatedByPath.set(candidate.path, {
        path: candidate.path,
        source: "semantic",
        score: Number(candidate.score.toFixed(6))
      });
    }
  }

  const relatedNotes = [...relatedByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  return {
    path: normalizedPath,
    relatedNotes,
    semanticCluster: semanticTop.map((candidate) => candidate.path)
  };
};
