import { EmbeddingService } from "../embedding.service"
import { DocumentService } from "../document.service"
import {
  isMeetingIntentQuery,
  rankAndDiversifyChunks,
  type DocumentKind,
} from "../../lib/document-kind"
import { createLogger, isProductionLogging, safeLogText } from "../../lib/logger"
import type { SourcesCollector } from "./sources-collector"

const DEFAULT_SIMILARITY_THRESHOLD = 0.6
const DEFAULT_CHUNK_LIMIT = 5
/** Oversample vector hits before soft re-rank + diversity. */
const VECTOR_OVERSAMPLE = 3
const DEFAULT_MAX_CHUNKS_PER_DOCUMENT = 2
const MAX_CHUNKS = 15

export type RetrievedChunk = {
  id: string
  chunkIndex: number
  content: string
  heading: string | null
  pageStart: number | null
  pageEnd: number | null
  similarity: number
  document: {
    id: string
    url: string
    title: string | null
    source: string | null
    mimeType: string | null
    docKind: DocumentKind | null
  }
}

/**
 * Embed a query and retrieve website document chunks (with ±1 adjacent context).
 * Soft re-ranks by doc kind (agendas/PDFs lightly demoted) and diversifies by document.
 * Meeting dumps are excluded from the vector candidate set unless the query is meeting-intent.
 * Shared by the search_website_documents tool.
 */
export async function retrieveWebsiteDocuments(
  query: string,
  source?: string,
  options?: {
    similarityThreshold?: number
    chunkLimit?: number
    maxChunks?: number
    maxChunksPerDocument?: number
    /** Override meeting-dump gate; default is derived from isMeetingIntentQuery(query). */
    excludeMeetingDumps?: boolean
  },
): Promise<RetrievedChunk[]> {
  const similarityThreshold =
    options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD
  const chunkLimit = options?.chunkLimit ?? DEFAULT_CHUNK_LIMIT
  const maxChunks = options?.maxChunks ?? MAX_CHUNKS
  const maxChunksPerDocument =
    options?.maxChunksPerDocument ?? DEFAULT_MAX_CHUNKS_PER_DOCUMENT
  const excludeMeetingDumps =
    options?.excludeMeetingDumps ?? !isMeetingIntentQuery(query)

  const embeddingService = new EmbeddingService()
  const queryEmbedding = await embeddingService.generateEmbedding(query)

  const documentService = new DocumentService()
  const vectorLimit = Math.max(chunkLimit * VECTOR_OVERSAMPLE, chunkLimit)
  const initialChunks = await documentService.searchSimilarChunks(
    queryEmbedding,
    vectorLimit,
    similarityThreshold,
    source ?? undefined,
    { excludeMeetingDumps },
  )

  const rankedChunks = rankAndDiversifyChunks(initialChunks, {
    limit: chunkLimit,
    maxChunksPerDocument,
  })

  const log = createLogger("retrieve", source)
  const queryPreview = safeLogText(query, 200)
  const queryLog = isProductionLogging()
    ? "query=(redacted)"
    : queryPreview
      ? `query=${JSON.stringify(queryPreview)}`
      : "query=(empty)"
  log.info(
    `${queryLog} threshold=${similarityThreshold} excludeMeetingDumps=${excludeMeetingDumps} hits=${initialChunks.length} ranked=${rankedChunks.length}`,
  )

  if (rankedChunks.length === 0) {
    return []
  }

  const pairKeys = new Set<string>()
  const pairs: Array<{ documentId: string; chunkIndex: number }> = []
  const add = (documentId: string, chunkIndex: number) => {
    if (chunkIndex < 0) return
    const key = `${documentId}:${chunkIndex}`
    if (pairKeys.has(key)) return
    pairKeys.add(key)
    pairs.push({ documentId, chunkIndex })
  }
  for (const c of rankedChunks) {
    const docId = c.document.id
    add(docId, c.chunkIndex - 1)
    add(docId, c.chunkIndex)
    add(docId, c.chunkIndex + 1)
  }

  const adjacentChunks = await documentService.getChunksByDocumentAndIndices(
    pairs,
    source ?? undefined,
  )

  const byKey = new Map<string, RetrievedChunk>()
  for (const c of rankedChunks) {
    byKey.set(`${c.document.id}:${c.chunkIndex}`, c)
  }
  for (const c of adjacentChunks) {
    const key = `${c.document.id}:${c.chunkIndex}`
    if (!byKey.has(key)) {
      byKey.set(key, { ...c, similarity: 0 })
    }
  }

  const merged = Array.from(byKey.values()).sort(
    (a, b) =>
      a.document.id.localeCompare(b.document.id) || a.chunkIndex - b.chunkIndex,
  )
  return merged.slice(0, maxChunks)
}

/** Format retrieved chunks for LLM context (tool result). */
export function formatRetrievedDocuments(
  chunks: RetrievedChunk[],
  collector?: SourcesCollector,
): string {
  if (chunks.length === 0) {
    return "No relevant documents found for the query."
  }

  const labeled = collector
    ? collector.register(chunks)
    : chunks.map((chunk, i) => ({ citationIndex: i + 1, chunk }))

  const contextParts = labeled.map(({ citationIndex, chunk }) => {
    const heading = chunk.heading ? `Heading: ${chunk.heading}\n` : ""
    const page =
      chunk.pageStart != null ? `Page: ${chunk.pageStart}\n` : ""
    const title = chunk.document.title
      ? `Title: ${chunk.document.title}\n`
      : ""
    return `[${citationIndex}]\n${title}${page}${heading}${chunk.content}`
  })

  return `Found ${chunks.length} relevant document chunk(s). Use the content below to answer the user. Prefer citing stable citizen-facing service pages over meeting agendas, minutes, or PDF packets when both support the answer or the user's question does not specify a specific document type. When you rely on a source for a specific fact, mark it inline with its index like [1] or [2]. Only cite indices you actually used. Do not include URLs, markdown hyperlinks, or a Sources section — the UI shows citation chips separately. Still use normal markdown formatting (bold, lists, headings) for readability.\n\n${contextParts.join("\n\n---\n\n")}`
}
