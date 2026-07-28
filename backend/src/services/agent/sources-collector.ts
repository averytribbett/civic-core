import type { ChatSource } from "../../lib/types/chat-source.types"
import type { RetrievedChunk } from "./retrieve-documents"

const SNIPPET_MAX = 240

export function buildSourceHref(
  url: string,
  pageStart: number | null,
  mimeType: string | null,
): string {
  const isPdf =
    (mimeType != null && mimeType.toLowerCase().includes("pdf")) ||
    url.toLowerCase().endsWith(".pdf")
  if (isPdf && pageStart != null && pageStart > 0) {
    return `${url}#page=${pageStart}`
  }
  return url
}

function toChatSource(
  citationIndex: number,
  chunk: RetrievedChunk,
): ChatSource {
  return {
    citationIndex,
    url: chunk.document.url,
    title: chunk.document.title,
    heading: chunk.heading,
    chunkIndex: chunk.chunkIndex,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    mimeType: chunk.document.mimeType,
    snippet: chunk.content.slice(0, SNIPPET_MAX),
    href: buildSourceHref(
      chunk.document.url,
      chunk.pageStart,
      chunk.document.mimeType,
    ),
  }
}

/**
 * Collects retrieved chunks with stable citation indices across tool calls
 * in a single chat turn. Indices are 1-based to match [1], [2] in the answer.
 */
export class SourcesCollector {
  private readonly byIndex = new Map<number, RetrievedChunk>()
  private nextIndex = 1

  /** Register chunks and return them paired with citation indices for formatting. */
  register(
    chunks: RetrievedChunk[],
  ): Array<{ citationIndex: number; chunk: RetrievedChunk }> {
    const registered: Array<{ citationIndex: number; chunk: RetrievedChunk }> =
      []
    for (const chunk of chunks) {
      const citationIndex = this.nextIndex++
      this.byIndex.set(citationIndex, chunk)
      registered.push({ citationIndex, chunk })
    }
    return registered
  }

  get(citationIndex: number): RetrievedChunk | undefined {
    return this.byIndex.get(citationIndex)
  }

  /** Parse [n] markers from the model reply and return only cited sources. */
  buildCitedSources(responseText: string): ChatSource[] {
    const cited = new Set<number>()
    for (const match of responseText.matchAll(/\[(\d+)\]/g)) {
      const n = parseInt(match[1]!, 10)
      if (Number.isFinite(n) && this.byIndex.has(n)) {
        cited.add(n)
      }
    }
    const sources = [...cited]
      .sort((a, b) => a - b)
      .map((citationIndex) =>
        toChatSource(citationIndex, this.byIndex.get(citationIndex)!),
      )

    // One chip per document URL even if multiple chunks/indices were cited
    const seenUrls = new Set<string>()
    return sources.filter((source) => {
      const key = source.url
      if (seenUrls.has(key)) return false
      seenUrls.add(key)
      return true
    })
  }
}
