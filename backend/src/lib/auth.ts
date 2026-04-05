import { Request, Response, NextFunction } from "express"
import { prisma } from "./prisma"

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

function normalizeAllowedOrigins(origins: string[]): string[] {
  return origins.map((s) => s.trim().toLowerCase()).filter(Boolean)
}

/**
 * Validates that the request comes from an allowed origin for the given source.
 * Uses Origin header (preferred for CORS) or Referer header.
 * Allowed origins are loaded from the Jurisdiction row for `req.body.source`.
 */
export async function requireOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const source = req.body?.source
    if (!source || typeof source !== "string") {
      res.status(400).json({
        error: "Invalid request",
        message: "Source is required",
      })
      return
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { source },
    })

    if (!jurisdiction) {
      res.status(403).json({
        error: "Forbidden",
        message: "Unknown or inactive source",
      })
      return
    }

    const allowed = normalizeAllowedOrigins(jurisdiction.origins)
    if (!allowed.length) {
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

    req.jurisdiction = jurisdiction
    next()
  } catch (err) {
    next(err)
  }
}
