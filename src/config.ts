import { config as loadDotenv } from "dotenv";

loadDotenv();

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitPrefixes = (value: string | undefined): string[] => {
  if (!value) {
    return ["architecture/", "core/"];
  }

  return value
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);
};

export const settings = {
  obsidianBaseUrl: process.env.OBSIDIAN_BASE_URL ?? "https://localhost:27124",
  obsidianApiKey: process.env.OBSIDIAN_API_KEY ?? "",
  obsidianVaultRoot: process.env.OBSIDIAN_VAULT_ROOT ?? "notes",
  vectorDbUrl: process.env.VECTOR_DB_URL ?? "",
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? "openai").toLowerCase().trim(),
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
  awsBedrockBearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK ?? "",
  bedrockEmbeddingDimensions: toInt(process.env.BEDROCK_EMBEDDING_DIMENSIONS, 1024),
  blockedOverwritePrefixes: splitPrefixes(process.env.BLOCKED_OVERWRITE_PREFIXES)
};
