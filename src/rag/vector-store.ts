export interface VectorDoc {
  path: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(doc: VectorDoc): Promise<void>;
  query(embedding: number[], topK?: number): Promise<VectorDoc[]>;
}

export class InMemoryVectorStore implements VectorStore {
  private docs: VectorDoc[] = [];

  async upsert(doc: VectorDoc): Promise<void> {
    this.docs = this.docs.filter((item) => item.path !== doc.path);
    this.docs.push(doc);
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
}
