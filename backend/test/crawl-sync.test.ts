import assert from "node:assert/strict"
import test from "node:test"
import { CrawlIngestPipeline } from "../src/services/crawl-sync.service"
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
    "test_source",
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
