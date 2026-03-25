export interface VectorDoc {
  path: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export class InMemoryVectorStore {
  private docs: VectorDoc[] = [];

  upsert(doc: VectorDoc): void {
    this.docs = this.docs.filter((item) => item.path !== doc.path);
    this.docs.push(doc);
  }

  query(embedding: number[], topK = 5): VectorDoc[] {
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
