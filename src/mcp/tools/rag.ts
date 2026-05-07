import { Embedder } from "../../rag/embedder.js";
import { type VectorStore } from "../../rag/vector-store.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { settings } from "../../config.js";

export const semanticSearch = async (store: VectorStore, query: string, topK = 5) => {
  const limit = clampTopK(topK, 5);
  const vector = await new Embedder().embedText(query);
  const docs = await store.query(vector, limit);

  const results = docs.map((doc) => {
    const score = dotProduct(vector, doc.embedding);
    return {
      path: doc.path,
      score: Number(score.toFixed(6)),
      source: "indexed" as const,
      excerpt: excerptFromContent(doc.content, query),
      metadata: doc.metadata
    };
  });

  return {
    query,
    topK: limit,
    backend: store.getBackend(),
    results
  };
};

const RAG_CACHE_TTL_MS = 30_000;
const MAX_SEMANTIC_SCAN_NOTES = 120;

type CachedNote = {
  content: string;
  embedding?: number[];
  refreshedAt: number;
};

const noteCache = new Map<string, CachedNote>();

const isFresh = (refreshedAt: number): boolean => Date.now() - refreshedAt < RAG_CACHE_TTL_MS;

const dotProduct = (left: number[], right: number[]): number => {
  const size = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < size; index += 1) {
    total += left[index] * right[index];
  }
  return total;
};

const clampTopK = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(30, Math.max(1, Math.floor(value ?? fallback)));
};

const firstNonEmptyParagraph = (content: string): string => {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return paragraphs[0] ?? "";
};

const excerptFromContent = (content: string, query?: string): string => {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!query?.trim()) {
    return firstNonEmptyParagraph(normalized).slice(0, 220);
  }

  const lower = normalized.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const position = lower.indexOf(lowerQuery);
  if (position < 0) {
    return firstNonEmptyParagraph(normalized).slice(0, 220);
  }

  const start = Math.max(0, position - 60);
  const end = Math.min(normalized.length, position + lowerQuery.length + 160);
  return normalized.slice(start, end).trim();
};

const markdownFiles = async (client: ObsidianClient): Promise<string[]> => {
  const tree = await client.walkTree();
  return tree.files.filter((path) => path.toLowerCase().endsWith(".md"));
};

const getNoteContentCached = async (client: ObsidianClient, path: string): Promise<string> => {
  const cached = noteCache.get(path);
  if (cached && isFresh(cached.refreshedAt)) {
    return cached.content;
  }

  const content = await client.readNote(path);
  noteCache.set(path, {
    content,
    embedding: cached?.embedding,
    refreshedAt: Date.now()
  });
  return content;
};

const getNoteEmbeddingCached = async (
  client: ObsidianClient,
  path: string,
  embedder: Embedder
): Promise<number[]> => {
  const cached = noteCache.get(path);
  if (cached && isFresh(cached.refreshedAt) && cached.embedding) {
    return cached.embedding;
  }

  const content = await getNoteContentCached(client, path);
  const embedding = await embedder.embedText(content);
  noteCache.set(path, { content, embedding, refreshedAt: Date.now() });
  return embedding;
};

const semanticFromStore = async (
  store: VectorStore,
  queryEmbedding: number[],
  topK: number
): Promise<{ path: string; score: number; excerpt: string }[]> => {
  const docs = await store.query(queryEmbedding, topK);
  return docs.map((doc) => ({
    path: doc.path,
    score: dotProduct(queryEmbedding, doc.embedding),
    excerpt: excerptFromContent(doc.content)
  }));
};

const semanticFromVault = async (
  client: ObsidianClient,
  queryEmbedding: number[],
  topK: number,
  options: { excludePath?: string; query?: string } = {}
): Promise<{ path: string; score: number; excerpt: string }[]> => {
  const embedder = new Embedder();
  const files = (await markdownFiles(client)).slice(0, MAX_SEMANTIC_SCAN_NOTES);
  const scored: { path: string; score: number; excerpt: string }[] = [];

  for (const file of files) {
    if (options.excludePath && file.toLowerCase() === options.excludePath.toLowerCase()) {
      continue;
    }

    try {
      const [content, embedding] = await Promise.all([
        getNoteContentCached(client, file),
        getNoteEmbeddingCached(client, file, embedder)
      ]);
      scored.push({
        path: file,
        score: dotProduct(queryEmbedding, embedding),
        excerpt: excerptFromContent(content, options.query)
      });
    } catch {
      // Keep best-effort behavior for context preparation tools.
    }
  }

  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, topK);
};

const normalizeScores = (pairs: Array<{ path: string; score: number }>): Map<string, number> => {
  const maxScore = pairs.reduce((acc, item) => Math.max(acc, item.score), 0);
  const normalized = new Map<string, number>();
  for (const pair of pairs) {
    normalized.set(pair.path, maxScore > 0 ? pair.score / maxScore : 0);
  }
  return normalized;
};

const normalizeWeights = (
  keywordWeightRaw: number,
  semanticWeightRaw: number
): { keywordWeight: number; semanticWeight: number } => {
  const keywordWeight = Number.isFinite(keywordWeightRaw) && keywordWeightRaw > 0 ? keywordWeightRaw : 0.45;
  const semanticWeight = Number.isFinite(semanticWeightRaw) && semanticWeightRaw > 0 ? semanticWeightRaw : 0.55;
  const sum = keywordWeight + semanticWeight;
  return {
    keywordWeight: keywordWeight / sum,
    semanticWeight: semanticWeight / sum
  };
};

const confidenceLabel = (score: number): "high" | "medium" | "low" => {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
};

export const hybridSearch = async (
  client: ObsidianClient,
  store: VectorStore,
  query: string,
  topK = 8
) => {
  const limit = clampTopK(topK, 8);
  const { keywordWeight, semanticWeight } = normalizeWeights(
    settings.hybridKeywordWeight,
    settings.hybridSemanticWeight
  );
  const keyword = await client.searchNotes(query);
  const embedder = new Embedder();
  const queryEmbedding = await embedder.embedText(query);

  const semanticFromIndexed = await semanticFromStore(store, queryEmbedding, limit * 2);
  const semantic =
    semanticFromIndexed.length > 0
      ? semanticFromIndexed
      : await semanticFromVault(client, queryEmbedding, limit * 2, { query });

  const keywordNormalized = normalizeScores(keyword.map((item) => ({ path: item.path, score: item.score })));
  const semanticNormalized = normalizeScores(semantic.map((item) => ({ path: item.path, score: item.score })));

  const allPaths = new Set<string>([
    ...keyword.map((item) => item.path),
    ...semantic.map((item) => item.path)
  ]);

  const results = [...allPaths]
    .map((path) => {
      const keywordScore = keywordNormalized.get(path) ?? 0;
      const semanticScore = semanticNormalized.get(path) ?? 0;
      const combinedScore = keywordScore * keywordWeight + semanticScore * semanticWeight;
      const keywordHit = keyword.find((item) => item.path === path);
      const semanticHit = semantic.find((item) => item.path === path);
      const source: "keyword" | "semantic" | "both" =
        keywordScore > 0 && semanticScore > 0
          ? "both"
          : keywordScore > 0
            ? "keyword"
            : "semantic";

      return {
        path,
        keywordScore: Number(keywordScore.toFixed(6)),
        semanticScore: Number(semanticScore.toFixed(6)),
        combinedScore: Number(combinedScore.toFixed(6)),
        source,
        confidence: confidenceLabel(combinedScore),
        excerpt: keywordHit?.excerpt ?? semanticHit?.excerpt ?? ""
      };
    })
    .sort((left, right) => right.combinedScore - left.combinedScore)
    .slice(0, limit);

  return {
    query,
    topK: limit,
    weights: {
      keyword: Number(keywordWeight.toFixed(4)),
      semantic: Number(semanticWeight.toFixed(4))
    },
    backend: store.getBackend(),
    semanticFallbackUsed: semanticFromIndexed.length === 0,
    results
  };
};

export const getSimilarNotes = async (
  client: ObsidianClient,
  store: VectorStore,
  path: string,
  topK = 8
) => {
  const limit = clampTopK(topK, 8);
  const embedder = new Embedder();
  const targetContent = await getNoteContentCached(client, path);
  const targetEmbedding = await getNoteEmbeddingCached(client, path, embedder);

  const storeCandidates = (await store
    .query(targetEmbedding, limit * 3))
    .map((doc) => ({
      path: doc.path,
      score: dotProduct(targetEmbedding, doc.embedding),
      excerpt: excerptFromContent(doc.content),
      source: "indexed" as const
    }))
    .filter((item) => item.path.toLowerCase() !== path.toLowerCase());

  const fallbackCandidates =
    storeCandidates.length >= limit
      ? []
      : (await semanticFromVault(client, targetEmbedding, limit * 3, { excludePath: path })).map((item) => ({
          ...item,
          source: "live" as const
        }));

  const merged = new Map<
    string,
    { path: string; score: number; excerpt: string; source: "indexed" | "live" }
  >();

  for (const candidate of [...storeCandidates, ...fallbackCandidates]) {
    const current = merged.get(candidate.path);
    if (!current || candidate.score > current.score) {
      merged.set(candidate.path, candidate);
    }
  }

  const results = [...merged.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => ({
      path: item.path,
      score: Number(item.score.toFixed(6)),
      source: item.source,
      excerpt: item.excerpt
    }));

  return {
    path,
    targetExcerpt: excerptFromContent(targetContent),
    results
  };
};

export const summarizeNotes = async (client: ObsidianClient, paths: string[]) => {
  const normalizedPaths = [...new Set(paths.map((item) => item.trim()).filter(Boolean))];
  const summaries: Array<{
    path: string;
    title: string;
    headings: string[];
    tags: string[];
    summary: string;
    charCount: number;
  }> = [];

  for (const path of normalizedPaths) {
    try {
      const content = await getNoteContentCached(client, path);
      const lines = content.replace(/\r\n/g, "\n").split("\n");
      const title =
        lines.find((line) => line.trim().startsWith("# "))?.replace(/^#\s+/, "").trim() ??
        path.split("/").pop()?.replace(/\.md$/i, "") ??
        path;
      const headings = lines
        .filter((line) => /^#{1,6}\s+/.test(line.trim()))
        .map((line) => line.trim().replace(/^#{1,6}\s+/, ""))
        .slice(0, 10);
      const tags = [...content.matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/g)].map((item) => item[2]).slice(0, 20);
      const summary = excerptFromContent(content).slice(0, 300);

      summaries.push({
        path,
        title,
        headings,
        tags: [...new Set(tags)],
        summary,
        charCount: content.length
      });
    } catch (error) {
      summaries.push({
        path,
        title: path,
        headings: [],
        tags: [],
        summary: error instanceof Error ? `Unable to summarize note: ${error.message}` : "Unable to summarize note",
        charCount: 0
      });
    }
  }

  return {
    totalNotes: summaries.length,
    totalChars: summaries.reduce((acc, item) => acc + item.charCount, 0),
    summaries
  };
};

export const getIndexStatus = async (client: ObsidianClient, store: VectorStore) => {
  const tree = await client.walkTree();
  const totalMarkdownNotes = tree.files.filter((path) => path.toLowerCase().endsWith(".md")).length;
  const indexedDocuments = await store.count();
  const lastIndexedAt = await store.getLastUpdatedAt();
  const coverage = totalMarkdownNotes > 0 ? indexedDocuments / totalMarkdownNotes : 0;

  return {
    totalMarkdownNotes,
    indexedDocuments,
    coverage: Number(coverage.toFixed(6)),
    coveragePct: Number((coverage * 100).toFixed(2)),
    lastIndexedAt,
    embeddingProvider: settings.embeddingProvider,
    vectorBackend: store.getBackend()
  };
};
