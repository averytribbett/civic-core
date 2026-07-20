/**
 * Application logger — the only module that should call console.*.
 *
 * Use `logger` for one-off lines, or `createLogger(scope, jurisdiction?)` for
 * tagged chat/crawl logs that include the uppercase jurisdiction id for export.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * Uppercase jurisdiction source id for log lines (e.g. chisago_county_mn → CHISAGO_COUNTY_MN).
 * Counties/cities can filter/export logs by this id.
 */
export function jurisdictionLogId(source: string | undefined | null): string {
  const trimmed = typeof source === "string" ? source.trim() : ""
  return trimmed ? trimmed.toUpperCase() : "UNKNOWN"
}

/**
 * Never log user/agent/widget message text (or retrieval queries derived from it) outside
 * local development — those strings can contain personal information.
 * Defaults to redacting when NODE_ENV is unset (e.g. Cloud Run).
 */
export function isProductionLogging(): boolean {
  const env = (process.env.NODE_ENV || "").toLowerCase()
  return env !== "development" && env !== "dev" && env !== "test"
}

/** Truncated preview for local/dev logs only; empty string in production. */
export function safeLogText(
  text: string | undefined | null,
  maxChars: number = 120,
): string {
  if (isProductionLogging()) return ""
  if (typeof text !== "string" || !text) return ""
  return text.length > maxChars ? text.slice(0, maxChars) : text
}

function write(level: LogLevel, message: string, ...args: unknown[]): void {
  switch (level) {
    case "debug":
      if (!isProductionLogging()) {
        // eslint-disable-next-line no-console
        console.debug(message, ...args)
      }
      break
    case "info":
      // eslint-disable-next-line no-console
      console.log(message, ...args)
      break
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(message, ...args)
      break
    case "error":
      // eslint-disable-next-line no-console
      console.error(message, ...args)
      break
  }
}

export type Logger = {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
  /** One JSON object per line (Cloud Logging–friendly). */
  json: (
    level: Exclude<LogLevel, "debug">,
    payload: Record<string, unknown>,
  ) => void
}

export const logger: Logger = {
  debug(message, ...args) {
    write("debug", message, ...args)
  },
  info(message, ...args) {
    write("info", message, ...args)
  },
  warn(message, ...args) {
    write("warn", message, ...args)
  },
  error(message, ...args) {
    write("error", message, ...args)
  },
  json(level, payload) {
    write(level, JSON.stringify(payload))
  },
}

/**
 * Scoped logger: `[chat][CHISAGO_COUNTY_MN] message`
 * Pass jurisdiction source for filterable county/city exports.
 */
export function createLogger(
  scope: string,
  jurisdiction?: string | null,
): Omit<Logger, "json"> {
  const jid =
    jurisdiction !== undefined && jurisdiction !== null
      ? jurisdictionLogId(jurisdiction)
      : null
  const prefix = jid ? `[${scope}][${jid}]` : `[${scope}]`

  return {
    debug(message, ...args) {
      logger.debug(`${prefix} ${message}`, ...args)
    },
    info(message, ...args) {
      logger.info(`${prefix} ${message}`, ...args)
    },
    warn(message, ...args) {
      logger.warn(`${prefix} ${message}`, ...args)
    },
    error(message, ...args) {
      logger.error(`${prefix} ${message}`, ...args)
    },
  }
}
