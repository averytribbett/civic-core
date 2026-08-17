import { Request, Response } from "express"
import { runCrawlSync } from "../../services/crawl-sync.service"
import { prisma } from "../../lib/prisma"
import { createLogger } from "../../lib/logger"

export const crawl = async (req: Request, res: Response) => {
  const startTime = Date.now()
  const log = createLogger(
    "crawl",
    typeof req.body?.source === "string" ? req.body.source : undefined,
  )

  try {
    const { url, source } = req.body

    if (!source) {
      return res.status(400).json({
        error: "Source is required",
        message:
          'Please provide a source identifier (e.g., "chisago_county_mn")',
      })
    }

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        message: "Please provide the seed URL to crawl",
      })
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { source },
    })
    if (!jurisdiction) {
      return res.status(404).json({
        error: "Unknown source",
        message: `No jurisdiction found for source "${source}"`,
      })
    }

    const upsertResult = await runCrawlSync({
      url,
      jurisdictionId: jurisdiction.id,
      logSource: jurisdiction.source,
    })

    const totalTimeMs = Date.now() - startTime
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(2)
    const { durationMs: _durationMs, ...documents } = upsertResult

    return res.status(200).json({
      success: true,
      message: "Crawl completed",
      data: {
        url,
        source,
        totalTimeMs,
        totalTimeSeconds: `${totalTimeSeconds}s`,
        documents,
      },
    })
  } catch (error: unknown) {
    const err = error as Error
    log.error(`error ${err.message}`)
    res.status(500).json({
      error: "Failed to process crawl request",
      message: err.message,
      details: err.stack,
    })
  }
}
