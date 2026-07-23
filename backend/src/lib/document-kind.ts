/**
 * Document kind classification and soft ranking penalties for RAG.
 * Similarity stays primary; penalties only break near-ties toward citizen-facing pages.
 * docKind is set at crawl — no URL fallbacks at query time.
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

/** Path/URL shapes that are usually meeting archives rather than citizen service pages. */
const MEETING_DUMP_PATH_PATTERN =
  /(?:^|\/)(?:meetings?|agendas?)(?:\/|$)|boarddocs|board[-\s]?packet|meeting[-\s]?packet/i

const MEETING_INTENT_QUERY_PATTERN =
  /\b(agenda|minutes|meeting|packet|board\s*packet)\b/i

/**
 * True when the URL looks like a meeting agenda/minutes/packet dump.
 * Used to skip crawl enqueue/ingest.
 */
export function isMeetingDumpUrl(url: string): boolean {
  let pathAndQuery = url
  try {
    const parsed = new URL(url)
    pathAndQuery = `${parsed.pathname}${parsed.search}`
  } catch {
    // keep raw url
  }
  if (MEETING_DUMP_PATH_PATTERN.test(pathAndQuery)) return true
  if (AGENDA_PATTERN.test(pathAndQuery) || MINUTES_PATTERN.test(pathAndQuery)) {
    return true
  }
  return AGENDA_PATTERN.test(url) || MINUTES_PATTERN.test(url)
}

/** True when the search query is asking about meetings / agendas / packets. */
export function isMeetingIntentQuery(query: string): boolean {
  return MEETING_INTENT_QUERY_PATTERN.test(query)
}

/**
 * Classify a document from MIME + URL/title heuristics at crawl time.
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
  if (isMeetingDumpUrl(input.url)) return "agenda"

  const mime = (input.mimeType ?? "").toLowerCase()
  const urlLower = input.url.toLowerCase()
  if (mime.includes("pdf") || urlLower.endsWith(".pdf")) return "pdf"
  if (mime.includes("html") || mime.includes("xhtml") || !mime) {
    return "html_page"
  }
  return "other"
}

export function docKindPenalty(kind: DocumentKind | null | undefined): number {
  if (!kind) return DOC_KIND_PENALTY.html_page
  return DOC_KIND_PENALTY[kind] ?? DOC_KIND_PENALTY.html_page
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
 * Uses stored docKind only (set at crawl).
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
    .map((chunk) => ({
      chunk,
      finalScore:
        chunk.similarity - docKindPenalty(chunk.document.docKind ?? null),
    }))
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
