import { ApiError } from "@/lib/api";

export type AiProviderMode = "LOCAL_GROUNDED" | "MESH" | "OPENAI_COMPATIBLE" | "GEMINI";

export type AiConfig = {
  provider: AiProviderMode;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  timeoutMs: number;
  fallbackReason?: "MISSING_CLOUD_KEY";
};

const providerModes: readonly AiProviderMode[] = ["LOCAL_GROUNDED", "MESH", "OPENAI_COMPATIBLE", "GEMINI"];

const defaults: Record<AiProviderMode, string> = {
  LOCAL_GROUNDED: "approved-content-v1",
  MESH: "openai/gpt-4o-mini",
  OPENAI_COMPATIBLE: "gpt-4o-mini",
  GEMINI: "gemini-2.0-flash",
};

/**
 * Gateways the tutor can reach without a per-deployment base URL. Mesh API (meshapi.ai) is an
 * OpenAI-compatible router, so it reuses the chat-completions adapter while keeping its own
 * provider label in answers, audit logs and the database.
 */
const defaultBaseUrls: Partial<Record<AiProviderMode, string>> = {
  MESH: "https://api.meshapi.ai/v1",
  OPENAI_COMPATIBLE: "https://api.openai.com/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta",
};

export function getAiConfig(): AiConfig {
  const providerValue = (process.env.AI_PROVIDER || "LOCAL_GROUNDED").toUpperCase();
  if (!providerModes.includes(providerValue as AiProviderMode)) {
    throw new ApiError(503, "AI_CONFIGURATION_ERROR", "The tutor provider is not configured correctly.");
  }

  const provider = providerValue as AiProviderMode;
  const timeoutValue = Number(process.env.AI_TIMEOUT_MS || 20_000);
  const timeoutMs = Number.isFinite(timeoutValue) ? Math.min(60_000, Math.max(2_000, timeoutValue)) : 20_000;
  const apiKey = process.env.AI_API_KEY?.trim();

  if (provider !== "LOCAL_GROUNDED" && !apiKey) {
    return {
      provider: "LOCAL_GROUNDED",
      model: defaults.LOCAL_GROUNDED,
      timeoutMs,
      fallbackReason: "MISSING_CLOUD_KEY",
    };
  }

  return {
    provider,
    apiKey,
    model: process.env.AI_MODEL?.trim() || defaults[provider],
    baseUrl: process.env.AI_BASE_URL?.trim() || defaultBaseUrls[provider],
    timeoutMs,
  };
}
