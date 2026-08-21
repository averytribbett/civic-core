export type LogoStorageMode = "local" | "gcs"

export type LlmProvider = "openai"

export type LlmReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "default"

/** Application configuration loaded once from environment variables. */
export type AppConfig = {
  nodeEnv: string
  port: number
  databaseUrl: string
  openai: {
    apiKey: string | undefined
    embeddingModel: string
    embeddingBatchSize: number
    webhookSecret: string | undefined
  }
  llm: {
    provider: LlmProvider
    model: string | undefined
    maxTokens: number
    reasoningEffort: LlmReasoningEffort
    temperature: number
  }
  security: {
    messageEncryptionKey: string | undefined
    messageEncryptionEnabled: boolean
  }
  widget: {
    allowedOrigins: readonly string[]
  }
  features: {
    voiceEnabled: boolean
    crawlDisabled: boolean
    devRoutesEnabled: boolean
  }
  voice: {
    realtimeModel: string
    realtimeVoice: string
    publicBaseUrl: string | undefined
  }
  logo: {
    storage: LogoStorageMode
    publicBaseUrl: string
    gcsBucket: string | undefined
    gcsPrefix: string
  }
  app: {
    timezone: string
  }
  crawl: {
    source: string | undefined
  }
}
