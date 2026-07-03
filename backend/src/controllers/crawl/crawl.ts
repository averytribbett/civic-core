import { Request, Response } from "express"
import { runCrawlSync } from "../../services/crawl-sync.service"

export const crawl = async (req: Request, res: Response) => {
  const startTime = Date.now()

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

    const upsertResult = await runCrawlSync({ url, source })

    const totalTimeMs = Date.now() - startTime
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(2)
    const { durationMs: _durationMs, ...documents } = upsertResult

    console.log("Crawl completed", {
      totalTimeMs,
      totalTimeSeconds: `${totalTimeSeconds}s`,
      documents: {
        created: documents.created,
        updated: documents.updated,
        deleted: documents.deleted,
        skipped: documents.skipped,
      },
    })

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
    console.error("Error in crawl function:", err)
    res.status(500).json({
      error: "Failed to process crawl request",
      message: err.message,
      details: err.stack,
    })
  }
}
