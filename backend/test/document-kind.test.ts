import assert from "node:assert/strict"
import test from "node:test"
import {
  classifyDocumentKind,
  docKindPenalty,
  rankAndDiversifyChunks,
} from "../src/lib/document-kind"

test("classifyDocumentKind prefers agenda/minutes over generic pdf", () => {
  assert.equal(
    classifyDocumentKind({
      url: "https://example.gov/meetings/2024-01-agenda.pdf",
      mimeType: "application/pdf",
    }),
    "agenda",
  )
  assert.equal(
    classifyDocumentKind({
      url: "https://example.gov/docs/board-minutes.pdf",
      title: "Board Minutes",
      mimeType: "application/pdf",
    }),
    "minutes",
  )
  assert.equal(
    classifyDocumentKind({
      url: "https://example.gov/fees.pdf",
      mimeType: "application/pdf",
    }),
    "pdf",
  )
  assert.equal(
    classifyDocumentKind({
      url: "https://example.gov/permits",
      title: "Building Permits",
      mimeType: "text/html",
    }),
    "html_page",
  )
})

test("rankAndDiversifyChunks demotes agendas and caps per document", () => {
  const chunks = [
    {
      id: "a1",
      chunkIndex: 0,
      similarity: 0.82,
      document: {
        id: "agenda-doc",
        url: "https://example.gov/agenda.pdf",
        title: "Agenda",
        docKind: "agenda" as const,
      },
    },
    {
      id: "a2",
      chunkIndex: 1,
      similarity: 0.81,
      document: {
        id: "agenda-doc",
        url: "https://example.gov/agenda.pdf",
        title: "Agenda",
        docKind: "agenda" as const,
      },
    },
    {
      id: "a3",
      chunkIndex: 2,
      similarity: 0.8,
      document: {
        id: "agenda-doc",
        url: "https://example.gov/agenda.pdf",
        title: "Agenda",
        docKind: "agenda" as const,
      },
    },
    {
      id: "h1",
      chunkIndex: 0,
      similarity: 0.79,
      document: {
        id: "html-doc",
        url: "https://example.gov/permits",
        title: "Permits",
        docKind: "html_page" as const,
      },
    },
  ]

  const ranked = rankAndDiversifyChunks(chunks, {
    limit: 3,
    maxChunksPerDocument: 2,
  })

  assert.equal(ranked.length, 3)
  assert.equal(ranked[0]?.document.id, "html-doc")
  assert.equal(
    ranked.filter((c) => c.document.id === "agenda-doc").length,
    2,
  )
  // Near-tie: html 0.79 beats agenda 0.82 - 0.08 = 0.74
  assert.ok(0.79 > 0.82 - docKindPenalty("agenda"))
})
