import type {
  AppConfig,
  LlmProvider,
  LlmReasoningEffort,
  LogoStorageMode,
} from "./types"

export type { AppConfig, LlmProvider, LlmReasoningEffort, LogoStorageMode }

const LLM_REASONING_EFFORTS = new Set<LlmReasoningEffort>([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "default",
])

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 4000
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 65535) return 4000
  return n
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseBool(raw: string | undefined): boolean {
  return raw === "true"
}

function parseLlmProvider(raw: string | undefined): LlmProvider {
  const provider = (raw || "openai").toLowerCase()
  if (provider !== "openai") {
    throw new Error(
      `LLM provider "${provider}" is not enabled. Only OpenAI is supported. Set LLM_PROVIDER=openai.`,
    )
  }
  return "openai"
}

function parseReasoningEffort(raw: string | undefined): LlmReasoningEffort {
  const effort = (raw || "none").toLowerCase()
  if (LLM_REASONING_EFFORTS.has(effort as LlmReasoningEffort)) {
    return effort as LlmReasoningEffort
  }
  return "none"
}

function parseLogoStorage(raw: string | undefined): LogoStorageMode {
  return raw?.trim().toLowerCase() === "gcs" ? "gcs" : "local"
}

function canonicalOriginFromUrlString(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin.trim()).origin.toLowerCase()
  } catch {
    return null
  }
}

function parseWidgetAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  const out: string[] = []
  for (const part of raw.split(",")) {
    const origin = canonicalOriginFromUrlString(part)
    if (origin) out.push(origin)
  }
  return out
}

function loadConfig(): AppConfig {
  const port = parsePort(process.env.PORT)
  const logoStorage = parseLogoStorage(process.env.LOGO_STORAGE)
  const logoPublicBaseUrl =
    trimOptional(process.env.LOGO_PUBLIC_BASE_URL)?.replace(/\/$/, "") ??
    `http://localhost:${port}`

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port,
    databaseUrl: process.env.DATABASE_URL ?? "",
    openai: {
      apiKey: trimOptional(process.env.OPENAI_API_KEY),
      embeddingModel:
        trimOptional(process.env.OPENAI_EMBEDDING_MODEL) ??
        "text-embedding-3-small",
      embeddingBatchSize: parsePositiveInt(
        process.env.EMBEDDING_BATCH_SIZE,
        100,
      ),
      webhookSecret: trimOptional(process.env.OPENAI_WEBHOOK_SECRET),
    },
    llm: {
      provider: parseLlmProvider(process.env.LLM_PROVIDER),
      model: trimOptional(process.env.LLM_MODEL),
      maxTokens: parsePositiveInt(process.env.LLM_MAX_TOKENS, 1000),
      reasoningEffort: parseReasoningEffort(process.env.LLM_REASONING_EFFORT),
      temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.7") || 0.7,
    },
    security: {
      messageEncryptionKey: trimOptional(process.env.MESSAGE_ENCRYPTION_KEY),
      messageEncryptionEnabled: Boolean(
        trimOptional(process.env.MESSAGE_ENCRYPTION_KEY),
      ),
    },
    widget: {
      allowedOrigins: parseWidgetAllowedOrigins(
        process.env.WIDGET_ALLOWED_ORIGINS,
      ),
    },
    features: {
      voiceEnabled: parseBool(process.env.VOICE_ENABLED),
      crawlDisabled: parseBool(process.env.DISABLE_CRAWL),
      devRoutesEnabled: parseBool(process.env.ENABLE_DEV_ROUTES),
    },
    voice: {
      realtimeModel:
        trimOptional(process.env.VOICE_REALTIME_MODEL) ?? "gpt-realtime-2.1",
      realtimeVoice:
        trimOptional(process.env.VOICE_REALTIME_VOICE) ?? "marin",
      publicBaseUrl: trimOptional(process.env.PUBLIC_BASE_URL)?.replace(
        /\/$/,
        "",
      ),
    },
    logo: {
      storage: logoStorage,
      publicBaseUrl: logoPublicBaseUrl,
      gcsBucket: trimOptional(process.env.GCS_ASSETS_BUCKET),
      gcsPrefix: (
        trimOptional(process.env.GCS_LOGO_PREFIX) ?? "logos"
      ).replace(/^\/+|\/+$/g, ""),
    },
    app: {
      timezone:
        trimOptional(process.env.APP_TIMEZONE) ??
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    crawl: {
      source: trimOptional(process.env.CRAWL_SOURCE),
    },
  }
}

/** Singleton config — loaded once at module import. */
export const config: AppConfig = loadConfig()
