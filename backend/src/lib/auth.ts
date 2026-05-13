import { Request, Response, NextFunction } from "express"
import { prisma } from "./prisma"

/**
 * Canonical browser origin (scheme + host + port) for CORS-style comparison.
 */
function canonicalOriginFromUrlString(urlOrOrigin: string): string | null {
  try {
    return new URL(urlOrOrigin.trim()).origin.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Origins allowed to call `/chat` (widget shell hosts). Set `WIDGET_ALLOWED_ORIGINS`
 * to a comma-separated list, e.g. `https://civic-core-widget.web.app,https://app.civiccore.ai`
 */
function getWidgetAllowedOrigins(): string[] {
  const raw = process.env.WIDGET_ALLOWED_ORIGINS
  if (!raw?.trim()) return []
  const out: string[] = []
  for (const part of raw.split(",")) {
    const c = canonicalOriginFromUrlString(part)
    if (c) out.push(c)
  }
  return out
}

function requestCanonicalOrigin(req: Request): string | null {
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

/**
 * Validates `Origin` / `Referer` against `WIDGET_ALLOWED_ORIGINS`, then loads
 * `Jurisdiction` by `req.body.source` and attaches `req.jurisdiction`.
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

    const widgetOrigins = getWidgetAllowedOrigins()
    if (!widgetOrigins.length) {
      res.status(503).json({
        error: "Service misconfigured",
        message: "WIDGET_ALLOWED_ORIGINS is not set or empty",
      })
      return
    }

    const requestOrigin = requestCanonicalOrigin(req)
    if (!requestOrigin) {
      res.status(403).json({
        error: "Forbidden",
        message: "Request origin could not be verified",
      })
      return
    }

    if (!widgetOrigins.includes(requestOrigin)) {
      res.status(403).json({
        error: "Forbidden",
        message: "Request is not allowed from this origin",
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

    req.jurisdiction = jurisdiction
    next()
  } catch (err) {
    next(err)
  }
}
