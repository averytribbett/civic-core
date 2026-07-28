import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { SourcesCollector, buildSourceHref } from "../src/services/agent/sources-collector"
import type { RetrievedChunk } from "../src/services/agent/retrieve-documents"

function fakeChunk(
  overrides: Partial<RetrievedChunk> & { id: string; url: string },
): RetrievedChunk {
  return {
    id: overrides.id,
    chunkIndex: overrides.chunkIndex ?? 0,
    content: overrides.content ?? "Some content about hours",
    heading: overrides.heading ?? null,
    pageStart: overrides.pageStart ?? null,
    pageEnd: overrides.pageEnd ?? null,
    similarity: overrides.similarity ?? 0.9,
    document: {
      id: overrides.document?.id ?? "doc-1",
      url: overrides.url,
      title: overrides.document?.title ?? "Clerk Hours",
      source: "test",
      mimeType: overrides.document?.mimeType ?? "text/html",
      docKind: overrides.document?.docKind ?? "html_page",
    },
  }
}

describe("SourcesCollector", () => {
  it("returns only cited indices from the reply", () => {
    const collector = new SourcesCollector()
    collector.register([
      fakeChunk({ id: "c1", url: "https://example.gov/a" }),
      fakeChunk({ id: "c2", url: "https://example.gov/b" }),
      fakeChunk({ id: "c3", url: "https://example.gov/c" }),
    ])

    const sources = collector.buildCitedSources(
      "Office hours are 9–5 [1]. Parking is free [3].",
    )

    assert.equal(sources.length, 2)
    assert.deepEqual(
      sources.map((s) => s.citationIndex),
      [1, 3],
    )
    assert.equal(sources[0]!.url, "https://example.gov/a")
    assert.equal(sources[1]!.url, "https://example.gov/c")
  })

  it("returns empty when the model cites nothing", () => {
    const collector = new SourcesCollector()
    collector.register([
      fakeChunk({ id: "c1", url: "https://example.gov/a" }),
    ])
    assert.deepEqual(collector.buildCitedSources("No citations here."), [])
  })

  it("dedupes chips to one entry per document URL", () => {
    const collector = new SourcesCollector()
    collector.register([
      fakeChunk({
        id: "c1",
        url: "https://example.gov/hours",
        chunkIndex: 0,
        document: { id: "doc-1", title: "Hours" },
      }),
      fakeChunk({
        id: "c2",
        url: "https://example.gov/hours",
        chunkIndex: 1,
        document: { id: "doc-1", title: "Hours" },
      }),
      fakeChunk({
        id: "c3",
        url: "https://example.gov/parking",
        chunkIndex: 0,
        document: { id: "doc-2", title: "Parking" },
      }),
    ])

    const sources = collector.buildCitedSources(
      "Hours are 9–5 [1]. More hours detail [2]. Parking is free [3].",
    )

    assert.equal(sources.length, 2)
    assert.deepEqual(
      sources.map((s) => s.url),
      ["https://example.gov/hours", "https://example.gov/parking"],
    )
    assert.equal(sources[0]!.citationIndex, 1)
  })
})

describe("buildSourceHref", () => {
  it("appends #page=N for PDFs with pageStart", () => {
    assert.equal(
      buildSourceHref("https://example.gov/file.pdf", 4, "application/pdf"),
      "https://example.gov/file.pdf#page=4",
    )
  })

  it("leaves HTML urls unchanged", () => {
    assert.equal(
      buildSourceHref("https://example.gov/hours", 4, "text/html"),
      "https://example.gov/hours",
    )
  })
})
