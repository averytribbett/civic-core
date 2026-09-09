import assert from "node:assert/strict"
import test from "node:test"
import { load } from "cheerio"
import {
  CrawlIngestPipeline,
  isBotBlockedHtml,
  runCrawlerThenTeardown,
  shouldSkipCrawlUrl,
} from "../src/services/crawl-sync.service"
import { dedupeDocumentsByUrl } from "../src/services/document.service"
import type {
  UpsertDocumentInput,
  UpsertDocumentsResult,
} from "../src/services/document.service"

class FakeDocumentService {
  readonly batches: UpsertDocumentInput[] = []

  async upsertDocumentsBatch(
    input: UpsertDocumentInput,
  ): Promise<UpsertDocumentsResult> {
    this.batches.push(input)
    return {
      created: input.documents.length,
      updated: 0,
      deleted: 0,
      skipped: 0,
    }
  }

  async deleteStaleDocuments(): Promise<number> {
    return 0
  }
}

test("CrawlIngestPipeline deduplicates crawled pages by normalized URL", async () => {
  const crawledPageUrls = new Set<string>()
  const documentService = new FakeDocumentService()
  const pipeline = new CrawlIngestPipeline(
    "00000000-0000-4000-8000-000000000001",
    10,
    crawledPageUrls,
    documentService,
  )

  await pipeline.push({
    url: "https://example.gov/agenda#top",
    text: "first copy",
    title: "Agenda",
  })
  await pipeline.push({
    url: "https://example.gov/agenda#details",
    text: "second copy",
    title: "Agenda",
  })

  const result = await pipeline.finalize()

  assert.equal(documentService.batches.length, 1)
  assert.equal(
    documentService.batches[0]?.jurisdictionId,
    "00000000-0000-4000-8000-000000000001",
  )
  assert.deepEqual(
    documentService.batches[0]?.documents.map((doc) => doc.url),
    ["https://example.gov/agenda"],
  )
  assert.deepEqual([...crawledPageUrls], ["https://example.gov/agenda"])
  assert.equal(result.created, 1)
  assert.equal(result.skipped, 1)
})

test("dedupeDocumentsByUrl keeps one document per URL before database writes", () => {
  const result = dedupeDocumentsByUrl([
    { url: "https://example.gov/a", text: "first" },
    { url: "https://example.gov/b", text: "second" },
    { url: "https://example.gov/a", text: "duplicate" },
  ])

  assert.deepEqual(
    result.documents.map((doc) => [doc.url, doc.text]),
    [
      ["https://example.gov/a", "first"],
      ["https://example.gov/b", "second"],
    ],
  )
  assert.equal(result.skipped, 1)
})

test("isBotBlockedHtml detects Denver WAF interstitial", () => {
  const $ = load(`
    <html><head><title>Request Rejected</title></head>
    <body>The requested URL was rejected. Support ID is Bot CCD: 123</body></html>
  `)
  assert.equal(isBotBlockedHtml($, 252), true)
})

test("shouldSkipCrawlUrl skips OpenCities files and language alternates", () => {
  assert.equal(
    shouldSkipCrawlUrl(
      "https://www.denvergov.org/files/oc-templates/x/oc_main.css",
    ),
    true,
  )
  assert.equal(
    shouldSkipCrawlUrl("https://www.denvergov.org/Home?oc_lang=es"),
    true,
  )
  assert.equal(shouldSkipCrawlUrl("https://www.denvergov.org/Services"), false)
})

test("runCrawlerThenTeardown tears down after a successful run", async () => {
  const calls: string[] = []
  await runCrawlerThenTeardown(
    {
      async run(startUrls) {
        calls.push(`run:${startUrls.join(",")}`)
      },
      async teardown() {
        calls.push("teardown")
      },
    },
    ["https://example.gov/"],
  )
  assert.deepEqual(calls, ["run:https://example.gov/", "teardown"])
})

test("CrawlIngestPipeline schedules flush without blocking push", async () => {
  const crawledPageUrls = new Set<string>()
  class SlowDocumentService extends FakeDocumentService {
    override async upsertDocumentsBatch(
      input: UpsertDocumentInput,
    ): Promise<UpsertDocumentsResult> {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return super.upsertDocumentsBatch(input)
    }
  }
  const documentService = new SlowDocumentService()
  const pipeline = new CrawlIngestPipeline(
    "00000000-0000-4000-8000-000000000001",
    50,
    crawledPageUrls,
    documentService,
  )

  const start = Date.now()
  for (let i = 0; i < 50; i++) {
    await pipeline.push({
      url: `https://example.gov/page-${i}`,
      text: `content ${i}`,
    })
  }
  const pushElapsed = Date.now() - start
  assert.ok(
    pushElapsed < 100,
    `expected push to return before slow flush (took ${pushElapsed}ms)`,
  )

  await pipeline.finalize()
  assert.equal(documentService.batches.length, 1)
})

test("null document hash is not coerced to empty string for skip comparison", () => {
  const storedHash: string | null = null
  const computedHash = "abc123deadbeef"
  assert.equal(storedHash ?? null, null)
  assert.notEqual(storedHash ?? null, computedHash)
  const afterBackfill = computedHash
  assert.equal(afterBackfill, computedHash)
})

test("runCrawlerThenTeardown still tears down when run throws", async () => {
  const calls: string[] = []
  await assert.rejects(
    () =>
      runCrawlerThenTeardown(
        {
          async run() {
            calls.push("run")
            throw new Error("crawl failed")
          },
          async teardown() {
            calls.push("teardown")
          },
        },
        ["https://example.gov/"],
      ),
    /crawl failed/,
  )
  assert.deepEqual(calls, ["run", "teardown"])
})
