/**
 * Document kind classification and soft ranking penalties for RAG.
 * Similarity stays primary; penalties only break near-ties toward citizen-facing pages.
 */

export const DOCUMENT_KINDS = [
  "html_page",
  "pdf",
  "agenda",
  "minutes",
  "other",
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** Soft penalties subtracted from cosine similarity (keep well under ~0.1). */
export const DOC_KIND_PENALTY: Record<DocumentKind, number> = {
  html_page: 0,
  other: 0.02,
  pdf: 0.03,
  agenda: 0.08,
  minutes: 0.08,
}

const AGENDA_PATTERN = /\b(agenda|packet|board[-\s]?packet|meeting[-\s]?packet)\b/i
const MINUTES_PATTERN = /\b(minutes|meeting[-\s]?minutes)\b/i

/**
 * Classify a document from MIME + URL/title heuristics.
 * Agenda/minutes win over generic PDF when URL or title matches.
 */
export function classifyDocumentKind(input: {
  url: string
  title?: string | null
  mimeType?: string | null
}): DocumentKind {
  const haystack = `${input.url} ${input.title ?? ""}`
  if (AGENDA_PATTERN.test(haystack)) return "agenda"
  if (MINUTES_PATTERN.test(haystack)) return "minutes"

  const mime = (input.mimeType ?? "").toLowerCase()
  const urlLower = input.url.toLowerCase()
  if (mime.includes("pdf") || urlLower.endsWith(".pdf")) return "pdf"
  if (mime.includes("html") || mime.includes("xhtml") || !mime) {
    return "html_page"
  }
  return "other"
}

export function docKindPenalty(kind: DocumentKind | null | undefined): number {
  if (!kind) return DOC_KIND_PENALTY.other
  return DOC_KIND_PENALTY[kind] ?? DOC_KIND_PENALTY.other
}

export function resolveDocKind(input: {
  docKind?: DocumentKind | null
  url: string
  title?: string | null
  mimeType?: string | null
}): DocumentKind {
  if (input.docKind) return input.docKind
  return classifyDocumentKind(input)
}

export type RankableChunk = {
  id: string
  chunkIndex: number
  similarity: number
  document: {
    id: string
    url: string
    title: string | null
    docKind?: DocumentKind | null
    mimeType?: string | null
  }
}

/**
 * Soft re-rank by similarity − kindPenalty, then diversify by document.
 * Returns up to `limit` chunks (vector hits only; neighbor expansion is separate).
 */
export function rankAndDiversifyChunks<T extends RankableChunk>(
  chunks: T[],
  options?: {
    limit?: number
    maxChunksPerDocument?: number
  },
): T[] {
  const limit = options?.limit ?? 5
  const maxChunksPerDocument = options?.maxChunksPerDocument ?? 2

  const scored = chunks
    .map((chunk) => {
      const kind = resolveDocKind({
        docKind: chunk.document.docKind,
        url: chunk.document.url,
        title: chunk.document.title,
        mimeType: chunk.document.mimeType,
      })
      return {
        chunk,
        finalScore: chunk.similarity - docKindPenalty(kind),
      }
    })
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
      return b.chunk.similarity - a.chunk.similarity
    })

  const perDoc = new Map<string, number>()
  const selected: T[] = []
  for (const { chunk } of scored) {
    const count = perDoc.get(chunk.document.id) ?? 0
    if (count >= maxChunksPerDocument) continue
    perDoc.set(chunk.document.id, count + 1)
    selected.push(chunk)
    if (selected.length >= limit) break
  }
  return selected
}
