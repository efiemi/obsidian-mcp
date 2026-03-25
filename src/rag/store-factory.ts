import { settings } from "../config.js";

import { PostgresVectorStore } from "./postgres-vector-store.js";
import { InMemoryVectorStore, type VectorStore } from "./vector-store.js";

export const createVectorStore = (): VectorStore => {
  if (settings.vectorDbUrl.trim()) {
    return new PostgresVectorStore(settings.vectorDbUrl.trim());
  }
  return new InMemoryVectorStore();
};
