import { Embedder } from "./embedder.js";
import { type VectorStore } from "./vector-store.js";

export class VaultIndexer {
  constructor(
    private readonly embedder: Embedder,
    private readonly store: VectorStore
  ) {}

  async indexNote(path: string, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.store.upsert({
      path,
      content,
      embedding: await this.embedder.embedText(content),
      metadata
    });
  }
}
