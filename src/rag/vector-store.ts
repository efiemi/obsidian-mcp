export interface VectorDoc {
  path: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(doc: VectorDoc): Promise<void>;
  delete(path: string): Promise<void>;
  query(embedding: number[], topK?: number): Promise<VectorDoc[]>;
  count(): Promise<number>;
  getLastUpdatedAt(): Promise<string | null>;
  getBackend(): string;
}

export class InMemoryVectorStore implements VectorStore {
  private docs: Array<VectorDoc & { updatedAt: string }> = [];

  async upsert(doc: VectorDoc): Promise<void> {
    this.docs = this.docs.filter((item) => item.path !== doc.path);
    this.docs.push({ ...doc, updatedAt: new Date().toISOString() });
  }

  async delete(path: string): Promise<void> {
    this.docs = this.docs.filter((item) => item.path !== path);
  }

  async query(embedding: number[], topK = 5): Promise<VectorDoc[]> {
    const dot = (a: number[], b: number[]): number => {
      const size = Math.min(a.length, b.length);
      let total = 0;
      for (let i = 0; i < size; i += 1) {
        total += a[i] * b[i];
      }
      return total;
    };

    return [...this.docs].sort((left, right) => dot(right.embedding, embedding) - dot(left.embedding, embedding)).slice(0, topK);
  }

  async count(): Promise<number> {
    return this.docs.length;
  }

  async getLastUpdatedAt(): Promise<string | null> {
    if (this.docs.length === 0) {
      return null;
    }
    return this.docs.reduce((latest, item) => (item.updatedAt > latest ? item.updatedAt : latest), this.docs[0].updatedAt);
  }

  getBackend(): string {
    return "in-memory";
  }
}
