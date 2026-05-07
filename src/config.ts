import { config as loadDotenv } from "dotenv";

loadDotenv();

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? "");
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
  bedrockMaxInputChars: toInt(process.env.BEDROCK_MAX_INPUT_CHARS, 25_000),
  hybridKeywordWeight: toFloat(process.env.HYBRID_KEYWORD_WEIGHT, 0.45),
  hybridSemanticWeight: toFloat(process.env.HYBRID_SEMANTIC_WEIGHT, 0.55),
  hybridBoostTagMatch: toFloat(process.env.HYBRID_BOOST_TAG_MATCH, 0.08),
  hybridBoostFolderMatch: toFloat(process.env.HYBRID_BOOST_FOLDER_MATCH, 0.05),
  hybridBoostRecentDays: toInt(process.env.HYBRID_BOOST_RECENT_DAYS, 30),
  hybridBoostRecentValue: toFloat(process.env.HYBRID_BOOST_RECENT_VALUE, 0.04),
  blockedOverwritePrefixes: splitPrefixes(process.env.BLOCKED_OVERWRITE_PREFIXES)
};
