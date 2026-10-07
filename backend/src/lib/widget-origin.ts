import type { Request } from "express"
import { config } from "../config"

/**
 * Canonical browser origin (scheme + host + port) for CORS-style comparison.
 */
export function canonicalOriginFromUrlString(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin.trim()).origin.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Origins allowed to call widget routes. Set `WIDGET_ALLOWED_ORIGINS`
 * to a comma-separated list, e.g. `https://civic-core-widget.web.app`
 */
export function getWidgetAllowedOrigins(): readonly string[] {
  return config.widget.allowedOrigins
}

export function requestCanonicalOrigin(req: Request): string | null {
  const originHeader = req.headers.origin
  if (originHeader && typeof originHeader === "string") {
    const c = canonicalOriginFromUrlString(originHeader)
    if (c) return c
  }
  const refererHeader = req.headers.referer
  if (refererHeader && typeof refererHeader === "string") {
    return canonicalOriginFromUrlString(refererHeader)
  }
  return null
}

export type WidgetOriginResult =
  | { ok: true }
  | { ok: false; status: number; error: string; message: string }

export function validateWidgetOrigin(req: Request): WidgetOriginResult {
  const widgetOrigins = getWidgetAllowedOrigins()
  if (!widgetOrigins.length) {
    return {
      ok: false,
      status: 503,
      error: "Service misconfigured",
      message: "WIDGET_ALLOWED_ORIGINS is not set or empty",
    }
  }

  const requestOrigin = requestCanonicalOrigin(req)
  if (!requestOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      message: "Request origin could not be verified",
    }
  }

  if (!widgetOrigins.includes(requestOrigin)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      message: "Request is not allowed from this origin",
    }
  }

  return { ok: true }
}
