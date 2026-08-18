import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"
import { validateWidgetOrigin } from "../../lib/widget-origin"
import { createLogger } from "../../lib/logger"

export const getBranding = async (req: Request, res: Response) => {
  const log = createLogger("widget-branding")

  try {
    const originCheck = validateWidgetOrigin(req)
    if (!originCheck.ok) {
      return res.status(originCheck.status).json({
        error: originCheck.error,
        message: originCheck.message,
      })
    }

    const source = req.query.source
    if (!source || typeof source !== "string" || !source.trim()) {
      return res.status(400).json({
        error: "Invalid request",
        message: "source query parameter is required",
      })
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { source: source.trim() },
      select: {
        source: true,
        name: true,
        logoUrl: true,
        themeColor: true,
      },
    })

    if (!jurisdiction) {
      return res.status(404).json({
        error: "Not found",
        message: "Unknown source",
      })
    }

    res.set("Cache-Control", "public, max-age=3600")

    const body: Record<string, string> = {
      source: jurisdiction.source,
      name: jurisdiction.name,
    }
    if (jurisdiction.logoUrl) body.logoUrl = jurisdiction.logoUrl
    if (jurisdiction.themeColor) body.themeColor = jurisdiction.themeColor

    return res.status(200).json(body)
  } catch (error: unknown) {
    const err = error as Error
    log.error(`get branding failed: ${err.message}`)
    return res.status(500).json({
      error: "Failed to load branding",
      message: err.message,
    })
  }
}
