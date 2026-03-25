import { Embedder } from "./embedder.js";
import { InMemoryVectorStore } from "./vector-store.js";

export class VaultIndexer {
  constructor(
    private readonly embedder: Embedder,
    private readonly store: InMemoryVectorStore
  ) {}

  async indexNote(path: string, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    this.store.upsert({
      path,
      content,
      embedding: await this.embedder.embedText(content),
      metadata
    });
  }
}
