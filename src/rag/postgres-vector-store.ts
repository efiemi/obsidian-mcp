import { Pool } from "pg";

import { type VectorDoc, type VectorStore } from "./vector-store.js";

const toVectorLiteral = (values: number[]): string => `[${values.map((value) => Number(value)).join(",")}]`;

const parseVectorText = (value: string): number[] => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  const items = trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.map((item) => Number(item));
};

export class PostgresVectorStore implements VectorStore {
  private readonly pool: Pool;

  private initPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector");
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS rag_documents (
          path TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          embedding VECTOR NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })();

    return this.initPromise;
  }

  async upsert(doc: VectorDoc): Promise<void> {
    await this.init();
    await this.pool.query(
      `
      INSERT INTO rag_documents (path, content, embedding, metadata, updated_at)
      VALUES ($1, $2, $3::vector, $4::jsonb, NOW())
      ON CONFLICT (path)
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [doc.path, doc.content, toVectorLiteral(doc.embedding), JSON.stringify(doc.metadata ?? {})]
    );
  }

  async delete(path: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM rag_documents WHERE path = $1", [path]);
  }

  async query(embedding: number[], topK = 5): Promise<VectorDoc[]> {
    await this.init();
    const result = await this.pool.query<{
      path: string;
      content: string;
      embedding_text: string;
      metadata: Record<string, unknown> | null;
    }>(
      `
      SELECT
        path,
        content,
        embedding::text AS embedding_text,
        metadata
      FROM rag_documents
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [toVectorLiteral(embedding), topK]
    );

    return result.rows.map((row) => ({
      path: row.path,
      content: row.content,
      embedding: parseVectorText(row.embedding_text),
      metadata: row.metadata ?? {}
    }));
  }

  async count(): Promise<number> {
    await this.init();
    const result = await this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM rag_documents");
    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  async getLastUpdatedAt(): Promise<string | null> {
    await this.init();
    const result = await this.pool.query<{ last_updated_at: string | null }>(
      "SELECT MAX(updated_at)::text AS last_updated_at FROM rag_documents"
    );
    return result.rows[0]?.last_updated_at ?? null;
  }

  getBackend(): string {
    return "postgres";
  }
}
