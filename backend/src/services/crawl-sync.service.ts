import { CheerioCrawler, log as crawleeLog, LogLevel } from "crawlee"
import {
  classifyDocumentKind,
  isMeetingDumpUrl,
} from "../lib/document-kind"
import {
  DocumentService,
  type UpsertDocumentInput,
  type UpsertDocumentsResult,
} from "./document.service"
import { TextProcessingService } from "./text-processing.service"
import { createLogger } from "../lib/logger"

export type RunCrawlSyncInput = {
  url: string
  jurisdictionId: string
  /** Slug for logs only (optional). */
  logSource?: string
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

/** WAF / bot interstitial pages (often HTTP 200 with tiny HTML). */
export function isBotBlockedHtml($: any, htmlLength?: number): boolean {
  try {
    const title = String($("title").first().text?.() ?? $("title").text()).trim()
    if (/request rejected|access denied|attention required|just a moment/i.test(title)) {
      return true
    }
    const bodyText = String($("body").text?.() ?? "")
    if (/support ID is Bot CCD|The requested URL was rejected/i.test(bodyText)) {
      return true
    }
    if (typeof htmlLength === "number" && htmlLength > 0 && htmlLength < 400) {
      if (/request rejected|url was rejected/i.test(bodyText + title)) return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * Skip asset/CMS noise and language-alternate duplicates that bloat crawls
 * (especially OpenCities /files and ?oc_lang=).
 */
export function shouldSkipCrawlUrl(rawUrl: string): boolean {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return true
  }

  const path = u.pathname.toLowerCase()
  if (
    path.startsWith("/files/") ||
    path.startsWith("/file/") ||
    path.includes("/oc-templates/") ||
    path.includes("/ocfavicon/")
  ) {
    return true
  }

  if (u.searchParams.has("oc_lang")) return true

  if (
    /\.(css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|zip|exe)(\?|$)/i.test(
      path,
    )
  ) {
    return true
  }

  return false
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
    private readonly jurisdictionId: string,
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
      { jurisdictionId: this.jurisdictionId, documents: batch },
      this.existingByUrl,
    )
    this.totals.created += result.created
    this.totals.updated += result.updated
    this.totals.skipped += result.skipped
  }

  async finalize(): Promise<UpsertDocumentsResult> {
    await this.flush()
    this.totals.deleted = await this.documentService.deleteStaleDocuments(
      this.jurisdictionId,
      this.crawledPageUrls,
    )
    return { ...this.totals }
  }
}

type CrawlerWithTeardown = {
  run: (startUrls: string[]) => Promise<unknown>
  teardown: () => Promise<void>
}

/** Run a Crawlee crawler, then teardown so persist-state timers cannot hang the process. */
export async function runCrawlerThenTeardown(
  crawler: CrawlerWithTeardown,
  startUrls: string[],
): Promise<void> {
  try {
    await crawler.run(startUrls)
  } finally {
    await crawler.teardown()
  }
}

/**
 * Crawl a jurisdiction website and upsert documents + embeddings (pipelined).
 */
export async function runCrawlSync(
  input: RunCrawlSyncInput,
): Promise<RunCrawlSyncResult> {
  const startTime = Date.now()
  const { url, jurisdictionId, logSource } = input

  if (!url?.trim()) {
    throw new Error("crawlUrl is required")
  }
  if (!jurisdictionId?.trim()) {
    throw new Error("jurisdictionId is required")
  }

  const allowedHostname = parseAllowedHostname(url)
  const textProcessingService = new TextProcessingService()
  const urlRegistry = new CrawlUrlRegistry()
  const crawledPageUrls = new Set<string>()
  const pipeline = new CrawlIngestPipeline(
    jurisdictionId,
    PIPELINE_BATCH_SIZE,
    crawledPageUrls,
  )
  const log = createLogger("crawl", logSource)
  let pageFailures = 0
  let meetingDumpSkipped = 0
  let emptyTextSkipped = 0
  let botBlocked = 0
  let noiseUrlSkipped = 0

  // Crawlee defaults to INFO (per-request noise). Keep warnings/errors only.
  crawleeLog.setLevel(LogLevel.WARNING)

  const enqueueOptions = {
    transformRequestFunction(req: { url: string }) {
      if (!isAllowedHostRequest(req, allowedHostname)) return false
      if (shouldSkipCrawlUrl(req.url)) {
        noiseUrlSkipped += 1
        return false
      }
      if (isMeetingDumpUrl(req.url)) {
        meetingDumpSkipped += 1
        return false
      }
      if (!urlRegistry.tryEnqueue(req.url)) return false
      return req
    },
  }

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, enqueueLinks, contentType, session, body }) {
      const pageUrl = request.loadedUrl ?? request.url
      const normalized = normalizeUrl(pageUrl)
      const mimeType = contentType?.type ?? ""
      const htmlLength =
        typeof body === "string"
          ? body.length
          : Buffer.isBuffer(body)
            ? body.length
            : undefined

      if (shouldSkipCrawlUrl(normalized)) {
        noiseUrlSkipped += 1
        return
      }

      if (isMeetingDumpUrl(normalized)) {
        meetingDumpSkipped += 1
        return
      }

      if (typeof $ === "function" && isBotBlockedHtml($, htmlLength)) {
        botBlocked += 1
        session?.retire()
        throw new Error(`Bot/WAF blocked response for ${normalized}`)
      }

      if (typeof $ !== "function") {
        if (mimeType.includes("pdf")) {
          const { text, pageMap } =
            await textProcessingService.extractPdfText(normalized)
          if (!text.trim()) {
            emptyTextSkipped += 1
            return
          }
          await pipeline.push({
            url: normalized,
            text,
            title: null,
            pageMap,
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
        if (!structured.text.trim()) {
          emptyTextSkipped += 1
        } else {
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
          session?.markGood()
        }
      } else {
        const text = textProcessingService.extractHtmlText($)
        const title = textProcessingService.extractHtmlTitle($)
        if (!text.trim()) {
          emptyTextSkipped += 1
        } else {
          await pipeline.push({
            url: normalized,
            text,
            title,
            ...pageDocumentMeta(normalized, title, mimeType || "text/html"),
          })
          session?.markGood()
        }
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
        if (hostname && !hostnamesEquivalent(hostname, allowedHostname)) {
          request.skipNavigation = true
          return
        }
        if (shouldSkipCrawlUrl(requestUrl)) {
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
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
        }
      },
    ],
    maxRequestRetries: 5,
    requestHandlerTimeoutSecs: 60,
    // Denver (and similar WAFs) rate-limit aggressive parallel crawls.
    maxConcurrency: 2,
    minConcurrency: 1,
    sameDomainDelaySecs: 1.5,
    useSessionPool: true,
    persistCookiesPerSession: true,
    ignoreHttpErrorStatusCodes: [401, 403, 404],
  })

  await runCrawlerThenTeardown(crawler, [url])

  const upsertResult = await pipeline.finalize()
  const durationMs = Date.now() - startTime

  log.info(
    `done ms=${durationMs} pages=${crawledPageUrls.size} created=${upsertResult.created} updated=${upsertResult.updated} deleted=${upsertResult.deleted} skipped=${upsertResult.skipped} meetingDumpSkipped=${meetingDumpSkipped} emptyTextSkipped=${emptyTextSkipped} botBlocked=${botBlocked} noiseUrlSkipped=${noiseUrlSkipped} pageFailures=${pageFailures}`,
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

/** Treat www.example.gov and example.gov as the same crawl host. */
function hostnamesEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  const stripWww = (h: string) => (h.startsWith("www.") ? h.slice(4) : h)
  return stripWww(a) === stripWww(b)
}

function isAllowedHostRequest(
  req: { url: string },
  allowedHostname: string,
): boolean {
  const hostname = tryGetHostname(req.url)
  return Boolean(hostname && hostnamesEquivalent(hostname, allowedHostname))
}
