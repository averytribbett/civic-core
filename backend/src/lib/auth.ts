import { Request, Response, NextFunction } from "express"
import { SourceType, SOURCE_CONFIG } from "./types/system-prompt.types"

/**
 * Get allowed origins for a source from its env var (defined in SOURCE_CONFIG).
 */
function getAllowedOriginsForSource(source: string): string[] | null {
  const config = SOURCE_CONFIG[source as SourceType]
  if (!config) return null
  const value = process.env[config.originsEnvVar]
  if (!value || typeof value !== "string") return null
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Extract origin (protocol + host) from a URL string.
 */
function parseOrigin(urlOrOrigin: string): { protocol: string; host: string } | null {
  try {
    const u = new URL(urlOrOrigin)
    return { protocol: u.protocol, host: u.hostname }
  } catch {
    return null
  }
}

/**
 * Check if request origin matches one of the allowed patterns.
 * Allowed patterns: exact origin (https://example.com) or host pattern (*.example.com).
 */
function originMatchesAllowed(
  requestOrigin: { protocol: string; host: string },
  allowed: string,
): boolean {
  const allowedLower = allowed.toLowerCase()
  if (allowedLower.startsWith("http://") || allowedLower.startsWith("https://")) {
    const parsed = parseOrigin(allowed)
    if (!parsed) return false
    return (
      requestOrigin.protocol === parsed.protocol &&
      requestOrigin.host === parsed.host
    )
  }
  if (allowedLower.startsWith("*.")) {
    const domain = allowedLower.slice(2)
    return (
      requestOrigin.host === domain ||
      requestOrigin.host.endsWith("." + domain)
    )
  }
  return requestOrigin.host === allowedLower
}

/**
 * Validates that the request comes from an allowed origin for the given source.
 * Uses Origin header (preferred for CORS) or Referer header.
 * Allowed origins are read from the env var defined in SOURCE_CONFIG (e.g. CHISAGO_COUNTY_MN_ORIGINS).
 */
export function requireOrigin(req: Request, res: Response, next: NextFunction): void {
  const source = req.body?.source
  if (!source || typeof source !== "string") {
    res.status(400).json({
      error: "Invalid request",
      message: "Source is required",
    })
    return
  }

  const allowed = getAllowedOriginsForSource(source)
  if (!allowed?.length) {
    res.status(403).json({
      error: "Forbidden",
      message: "Source is not configured for origin validation",
    })
    return
  }

  const originHeader = req.headers.origin
  const refererHeader = req.headers.referer

  let requestOrigin: { protocol: string; host: string } | null = null
  if (originHeader && typeof originHeader === "string") {
    requestOrigin = parseOrigin(originHeader)
  }
  if (!requestOrigin && refererHeader && typeof refererHeader === "string") {
    requestOrigin = parseOrigin(refererHeader)
  }

  if (!requestOrigin) {
    res.status(403).json({
      error: "Forbidden",
      message: "Request origin could not be verified",
    })
    return
  }

  const matches = allowed.some((a) => originMatchesAllowed(requestOrigin!, a))
  if (!matches) {
    res.status(403).json({
      error: "Forbidden",
      message: "Request is not allowed from this origin",
    })
    return
  }

  next()
}
