import { createHash } from "node:crypto";

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import axios from "axios";

import { settings } from "../config.js";

export class Embedder {
  private readonly provider: string;

  constructor() {
    this.provider = settings.embeddingProvider;
  }

  async embedText(text: string): Promise<number[]> {
    if (this.provider === "bedrock") {
      return this.embedWithBedrock(text);
    }

    const digest = createHash("sha256").update(text, "utf-8").digest();
    return Array.from(digest.subarray(0, 32)).map((value) => value / 255);
  }

  private truncateForBedrock(text: string): string {
    const maxChars = settings.bedrockMaxInputChars;
    if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars);
  }

  private formatRemoteError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
      const statusLabel = status ? `HTTP ${status}` : "request failed";
      return `Bedrock embedding error (${statusLabel}): ${payload}`;
    }
    if (error instanceof Error) {
      return `Bedrock embedding error: ${error.message}`;
    }
    return "Bedrock embedding error: unknown error";
  }

  private bedrockPayload(text: string): Record<string, unknown> {
    return {
      inputText: this.truncateForBedrock(text),
      dimensions: settings.bedrockEmbeddingDimensions,
      normalize: true
    };
  }

  private async embedWithBedrock(text: string): Promise<number[]> {
    if (settings.awsBedrockBearerToken) {
      return this.embedWithBedrockBearerToken(text);
    }

    return this.embedWithAwsSdk(text);
  }

  private async embedWithBedrockBearerToken(text: string): Promise<number[]> {
    try {
      const endpoint = `https://bedrock-runtime.${settings.awsRegion}.amazonaws.com/model/${settings.bedrockModelId}/invoke`;
      const response = await axios.post(endpoint, this.bedrockPayload(text), {
        headers: {
          Authorization: `Bearer ${settings.awsBedrockBearerToken}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        timeout: 30_000
      });

      const embedding = (response.data as { embedding?: unknown }).embedding;
      if (!Array.isArray(embedding)) {
        throw new Error("Bedrock response missing embedding");
      }

      return embedding.map(Number);
    } catch (error: unknown) {
      throw new Error(this.formatRemoteError(error));
    }
  }

  private async embedWithAwsSdk(text: string): Promise<number[]> {
    try {
      const client = new BedrockRuntimeClient({ region: settings.awsRegion });
      const command = new InvokeModelCommand({
        modelId: settings.bedrockModelId,
        body: JSON.stringify(this.bedrockPayload(text)),
        contentType: "application/json",
        accept: "application/json"
      });

      const response = await client.send(command);
      if (!response.body) {
        throw new Error("Bedrock response body is empty");
      }

      const payload = JSON.parse(new TextDecoder().decode(response.body));
      const embedding = (payload as { embedding?: unknown }).embedding;

      if (!Array.isArray(embedding)) {
        throw new Error("Bedrock response missing embedding");
      }

      return embedding.map(Number);
    } catch (error: unknown) {
      throw new Error(this.formatRemoteError(error));
    }
  }
}
