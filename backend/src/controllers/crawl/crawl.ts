import { Request, Response } from "express"
import { CheerioCrawler } from "crawlee"
import { TextProcessingService } from "../../services/text-processing.service"
import {
  DocumentService,
  UpsertDocumentInput,
} from "../../services/document.service"

export const crawl = async (req: Request, res: Response) => {
  const startTime = Date.now()

  try {
    const { url, source, test = false } = req.body

    const textProcessingService = new TextProcessingService()

    if (!source) {
      return res.status(400).json({
        error: "Source is required",
        message:
          'Please provide a source identifier (e.g., "chisago_county_mn")',
      })
    }

    // CheerioCrawler crawls the web using HTTP requests
    // and parses HTML using the Cheerio library.
    // MIME types to skip (no HTML, no PDF extraction) — avoids errors and retries
    const SKIP_MIME_TYPES = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/octet-stream", // often zip or other binary
      "text/calendar", // calendar files
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // word documents
    ]
    const isSkippedMimeType = (type: string | undefined) =>
      type && SKIP_MIME_TYPES.some((skip) => type.includes(skip))

    const documentInput: UpsertDocumentInput = {
      source,
      documents: [],
    }

    // Deduplicate at crawl level: same URL can be enqueued from multiple pages or with fragments
    const seenUrls = new Set<string>()
    const normalizeUrl = (raw: string): string => {
      try {
        const u = new URL(raw)
        u.hash = ""
        return u.href
      } catch {
        return raw
      }
    }

    const crawler = new CheerioCrawler({
      // Use the requestHandler to process each of the crawled pages.
      async requestHandler({ request, $, enqueueLinks, log, contentType }) {
        log.info(`Processing URL: ${request.loadedUrl ?? request.url}`)
        const mimeType = contentType?.type ?? ""
        const url = request.loadedUrl ?? request.url
        const normalized = normalizeUrl(url)

        if (seenUrls.has(normalized)) {
          log.debug(`Skipping duplicate URL: ${url}`)
          await enqueueLinks()
          return
        }
        seenUrls.add(normalized)

        // Non-HTML response: handle by type or skip
        if (typeof $ !== "function") {
          if (mimeType.includes("pdf")) {
            const text = await textProcessingService.extractPdfText(url)
            documentInput.documents.push({ url, text, title: null })
            return
          }
          if (mimeType.includes("image/jpeg")) {
            // @TODO: handle image/jpeg with OCR
            return
          }
          if (isSkippedMimeType(mimeType)) {
            return
          }
          return
        }

        const isImage = mimeType.includes("image/jpeg")
        if (isImage) {
          return
        }

        const structured = textProcessingService.extractHtmlStructured($)
        if (structured) {
          documentInput.documents.push({
            url,
            text: structured.text,
            title: structured.title,
            segments: structured.segments,
          })
        } else {
          const text = textProcessingService.extractHtmlText($)
          documentInput.documents.push({ url, text, title: textProcessingService.extractHtmlTitle($) })
        }

        // Extract links from the current page and add them to the crawling queue.
        await enqueueLinks()
      },

      failedRequestHandler({ request, log }, error) {
        log.error(`Failed: ${request.url}`, { error: error.message })
      },

      additionalMimeTypes: [
        "application/pdf",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
        "text/calendar",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      // maxRequestsPerCrawl: 100,
      preNavigationHooks: [
        async ({ request }) => {
          request.headers = {
            ...request.headers,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
              "AppleWebKit/537.36 (KHTML, like Gecko) " +
              "Chrome/121.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml,application/pdf,image/jpeg;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          }
        },
      ],
      maxRequestRetries: 5,
      requestHandlerTimeoutSecs: 60,
      maxConcurrency: 5,
      useSessionPool: true,
      persistCookiesPerSession: true,
      // Ignore Unauthorized, Forbidden, and Not Found errors
      ignoreHttpErrorStatusCodes: [401, 403, 404],
    })

    // Add first URL to the queue and start the crawl.
    await crawler.run([url])

    const documentService = new DocumentService()
    const upsertResult = await documentService.upsertDocuments(documentInput)

    const totalTimeMs = Date.now() - startTime
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(2)

    console.log("Crawl completed", {
      totalTimeMs,
      totalTimeSeconds: `${totalTimeSeconds}s`,
      documents: {
        created: upsertResult.created,
        updated: upsertResult.updated,
        deleted: upsertResult.deleted,
        skipped: upsertResult.skipped,
      },
    })

    return res.status(200).json({
      success: true,
      message: "Crawl completed",
      data: {
        url: url,
        source: source,
        test: test,
        totalTimeMs,
        totalTimeSeconds: `${totalTimeSeconds}s`,
        documents: upsertResult,
      },
    })
  } catch (error: any) {
    console.error("Error in crawl function:", error)
    res.status(500).json({
      error: "Failed to process crawl request",
      message: error.message,
      details: error.stack,
    })
  }
}
