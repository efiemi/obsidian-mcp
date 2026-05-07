import { createHash } from "node:crypto";

const withoutCodeBlocks = (content: string): string => content.replace(/```[\s\S]*?```/g, "");

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

const parseTags = (frontmatterTags: unknown, content: string): string[] => {
  const tags = new Set<string>();

  if (typeof frontmatterTags === "string") {
    const trimmed = frontmatterTags.trim();
    const values =
      trimmed.startsWith("[") && trimmed.endsWith("]")
        ? trimmed.slice(1, -1).split(",")
        : trimmed.split(",");
    for (const item of values) {
      const value = item.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
      if (value) {
        tags.add(value);
      }
    }
  }

  const tagRegex = /(^|\s)#([a-zA-Z0-9/_-]+)/g;
  for (const match of withoutCodeBlocks(content).matchAll(tagRegex)) {
    const value = match[2]?.trim();
    if (value) {
      tags.add(value);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
};

const extractHeadings = (content: string): string[] =>
  content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, ""))
    .slice(0, 20);

const extractTitle = (path: string, content: string): string => {
  const heading = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  if (heading) {
    return heading.replace(/^#\s+/, "").trim();
  }
  const fileName = path.split("/").pop() ?? path;
  return fileName.replace(/\.md$/i, "");
};

const detectLang = (content: string): "pt" | "en" | "unknown" => {
  const sample = content.slice(0, 4000).toLowerCase();
  const ptSignals = ["ção", "ções", " para ", " com ", " não ", " em ", " de "];
  const enSignals = [" the ", " and ", " with ", " for ", " not ", " in ", " of "];
  const ptScore = ptSignals.reduce((acc, signal) => acc + (sample.includes(signal) ? 1 : 0), 0);
  const enScore = enSignals.reduce((acc, signal) => acc + (sample.includes(signal) ? 1 : 0), 0);
  if (ptScore === 0 && enScore === 0) {
    return "unknown";
  }
  return ptScore >= enScore ? "pt" : "en";
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

export const buildNoteMetadata = (
  relPath: string,
  content: string,
  options: { updatedAt?: string; backlinksCount?: number } = {}
): Record<string, unknown> => {
  const normalized = relPath.trim().replace(/^\/+/, "");
  const folder = normalized.includes("/") ? normalized.split("/").slice(0, -1).join("/") : "";
  const depth = folder ? folder.split("/").length : 0;
  const normalizedText = content.replace(/\r\n/g, "\n");
  const words = normalizedText.trim() ? normalizedText.trim().split(/\s+/).length : 0;
  const frontmatter = parseFrontmatter(content);
  const tags = parseTags(frontmatter.tags, content);
  const headings = extractHeadings(content);
  const outgoingLinks = extractOutgoingLinks(content);

  return {
    type: "note",
    path: normalized,
    title: extractTitle(normalized, content),
    folder,
    depth,
    tags,
    headings,
    links_out_count: outgoingLinks.length,
    links_in_count: Number.isFinite(options.backlinksCount) ? Number(options.backlinksCount) : 0,
    char_count: normalizedText.length,
    word_count: words,
    updated_at: options.updatedAt ?? null,
    indexed_at: new Date().toISOString(),
    lang: detectLang(normalizedText),
    content_hash: createHash("sha256").update(normalizedText, "utf-8").digest("hex")
  };
};
