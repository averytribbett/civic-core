import { CheerioCrawler, log as crawleeLog, LogLevel } from "crawlee"
import { classifyDocumentKind } from "../lib/document-kind"
import {
  DocumentService,
  type UpsertDocumentInput,
  type UpsertDocumentsResult,
} from "./document.service"
import { TextProcessingService } from "./text-processing.service"
import { createLogger } from "../lib/logger"

export type RunCrawlSyncInput = {
  url: string
  source: string
}

export type RunCrawlSyncResult = UpsertDocumentsResult & {
  durationMs: number
}

const SKIP_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "text/calendar",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

/** Pages buffered before embed/upsert during crawl. */
const PIPELINE_BATCH_SIZE = 50

function isSkippedMimeType(type: string | undefined): boolean {
  return Boolean(type && SKIP_MIME_TYPES.some((skip) => type.includes(skip)))
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ""
    return u.href
  } catch {
    return raw
  }
}

function parseAllowedHostname(seedUrl: string): string {
  return new URL(seedUrl).hostname.toLowerCase()
}

type CrawlPageDocument = UpsertDocumentInput["documents"][number]

function pageDocumentMeta(
  url: string,
  title: string | null | undefined,
  mimeType: string,
): Pick<CrawlPageDocument, "mimeType" | "docKind"> {
  const normalizedMime = mimeType || null
  return {
    mimeType: normalizedMime,
    docKind: classifyDocumentKind({
      url,
      title,
      mimeType: normalizedMime,
    }),
  }
}

type CrawlIngestDocumentService = Pick<
  DocumentService,
  "upsertDocumentsBatch" | "deleteStaleDocuments"
>

/**
 * Tracks normalized URLs so each is only queued and fetched once per crawl.
 */
class CrawlUrlRegistry {
  /** URLs already added to the crawl queue (via enqueueLinks transform). */
  private readonly enqueuedUrls = new Set<string>()
  /** URLs that have started a fetch (preNavigation). */
  private readonly fetchedUrls = new Set<string>()

  /** Returns false if this URL was already enqueued from another page. */
  tryEnqueue(rawUrl: string): boolean {
    const normalized = normalizeUrl(rawUrl)
    if (this.enqueuedUrls.has(normalized)) return false
    this.enqueuedUrls.add(normalized)
    return true
  }

  /** Returns false if this URL was already fetched (skip second HTTP request). */
  tryBeginFetch(rawUrl: string): boolean {
    const normalized = normalizeUrl(rawUrl)
    if (this.fetchedUrls.has(normalized)) return false
    this.fetchedUrls.add(normalized)
    if (!this.enqueuedUrls.has(normalized)) {
      this.enqueuedUrls.add(normalized)
    }
    return true
  }

  hasFetched(rawUrl: string): boolean {
    return this.fetchedUrls.has(normalizeUrl(rawUrl))
  }
}

/**
 * Buffers crawled pages and upserts in batches while the crawl runs.
 */
export class CrawlIngestPipeline {
  private readonly buffer: CrawlPageDocument[] = []
  private readonly existingByUrl = new Map<
    string,
    { id: string; hash: string }
  >()
  private readonly totals: UpsertDocumentsResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  }

  constructor(
    private readonly source: string,
    private readonly batchSize: number,
    /** Canonical URLs successfully queued for ingest (one row per page). */
    private readonly crawledPageUrls: Set<string>,
    private readonly documentService: CrawlIngestDocumentService = new DocumentService(),
  ) {}

  async push(doc: CrawlPageDocument): Promise<void> {
    const normalizedUrl = normalizeUrl(doc.url)
    if (this.crawledPageUrls.has(normalizedUrl)) {
      this.totals.skipped += 1
      return
    }

    this.crawledPageUrls.add(normalizedUrl)
    this.buffer.push({ ...doc, url: normalizedUrl })
    if (this.buffer.length >= this.batchSize) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const batch = this.buffer.splice(0, this.buffer.length)
    const result = await this.documentService.upsertDocumentsBatch(
      { source: this.source, documents: batch },
      this.existingByUrl,
    )
    this.totals.created += result.created
    this.totals.updated += result.updated
    this.totals.skipped += result.skipped
  }

  async finalize(): Promise<UpsertDocumentsResult> {
    await this.flush()
    this.totals.deleted = await this.documentService.deleteStaleDocuments(
      this.source,
      this.crawledPageUrls,
    )
    return { ...this.totals }
  }
}

/**
 * Crawl a jurisdiction website and upsert documents + embeddings (pipelined).
 */
export async function runCrawlSync(
  input: RunCrawlSyncInput,
): Promise<RunCrawlSyncResult> {
  const startTime = Date.now()
  const { url, source } = input

  if (!url?.trim()) {
    throw new Error("crawlUrl is required")
  }
  if (!source?.trim()) {
    throw new Error("source is required")
  }

  const allowedHostname = parseAllowedHostname(url)
  const textProcessingService = new TextProcessingService()
  const urlRegistry = new CrawlUrlRegistry()
  const crawledPageUrls = new Set<string>()
  const pipeline = new CrawlIngestPipeline(
    source,
    PIPELINE_BATCH_SIZE,
    crawledPageUrls,
  )
  const log = createLogger("crawl", source)
  let pageFailures = 0

  // Crawlee defaults to INFO (per-request noise). Keep warnings/errors only.
  crawleeLog.setLevel(LogLevel.WARNING)

  const enqueueOptions = {
    transformRequestFunction(req: { url: string }) {
      if (!isAllowedHostRequest(req, allowedHostname)) return false
      if (!urlRegistry.tryEnqueue(req.url)) return false
      return req
    },
  }

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, enqueueLinks, contentType }) {
      const pageUrl = request.loadedUrl ?? request.url
      const normalized = normalizeUrl(pageUrl)
      const mimeType = contentType?.type ?? ""

      if (typeof $ !== "function") {
        if (mimeType.includes("pdf")) {
          const text = await textProcessingService.extractPdfText(normalized)
          await pipeline.push({
            url: normalized,
            text,
            title: null,
            ...pageDocumentMeta(normalized, null, mimeType || "application/pdf"),
          })
          return
        }
        if (mimeType.includes("image/jpeg")) {
          return
        }
        if (isSkippedMimeType(mimeType)) {
          return
        }
        return
      }

      if (mimeType.includes("image/jpeg")) {
        return
      }

      const structured = textProcessingService.extractHtmlStructured($)
      if (structured) {
        await pipeline.push({
          url: normalized,
          text: structured.text,
          title: structured.title,
          segments: structured.segments,
          ...pageDocumentMeta(
            normalized,
            structured.title,
            mimeType || "text/html",
          ),
        })
      } else {
        const text = textProcessingService.extractHtmlText($)
        const title = textProcessingService.extractHtmlTitle($)
        await pipeline.push({
          url: normalized,
          text,
          title,
          ...pageDocumentMeta(normalized, title, mimeType || "text/html"),
        })
      }

      await enqueueLinks(enqueueOptions)
    },

    failedRequestHandler({ request }, error) {
      pageFailures += 1
      log.warn(
        `page failed url=${request.url} error=${error instanceof Error ? error.message : String(error)}`,
      )
    },

    additionalMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
      "text/calendar",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    preNavigationHooks: [
      async ({ request }) => {
        const requestUrl = request.loadedUrl ?? request.url
        const hostname = tryGetHostname(requestUrl)
        if (hostname && hostname !== allowedHostname) {
          request.skipNavigation = true
          return
        }
        if (!urlRegistry.tryBeginFetch(requestUrl)) {
          request.skipNavigation = true
          return
        }
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
    ignoreHttpErrorStatusCodes: [401, 403, 404],
  })

  await crawler.run([url])

  const upsertResult = await pipeline.finalize()
  const durationMs = Date.now() - startTime

  log.info(
    `done ms=${durationMs} pages=${crawledPageUrls.size} created=${upsertResult.created} updated=${upsertResult.updated} deleted=${upsertResult.deleted} skipped=${upsertResult.skipped} pageFailures=${pageFailures}`,
  )

  return { ...upsertResult, durationMs }
}

function tryGetHostname(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isAllowedHostRequest(
  req: { url: string },
  allowedHostname: string,
): boolean {
  const hostname = tryGetHostname(req.url)
  return Boolean(hostname && hostname === allowedHostname)
}
