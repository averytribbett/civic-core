import { PDFParse } from "pdf-parse"

// ~2 chars/token; 2k chars keeps chunks embed-friendly and improves RAG retrieval granularity
const CHUNK_SIZE = 2000
const OVERLAP = 100

export type HtmlSegment = {
  heading: string | null
  text: string
  startIndex: number
  endIndex: number
}

export type PageRange = {
  page: number
  startIndex: number
  endIndex: number
}

export type ExtractHtmlStructuredResult = {
  title: string | null
  text: string
  segments: HtmlSegment[]
}

export type ExtractPdfResult = {
  text: string
  pageMap: PageRange[]
}

export type ChunkWithMeta = {
  content: string
  heading: string | null
  pageStart: number | null
  pageEnd: number | null
}

export class TextProcessingService {
  /** Extract page title from <title> or first <h1>. */
  extractHtmlTitle = ($: any): string | null => {
    const title = $("title").first().text().trim()
    if (title) return title
    const h1 = $("h1").first().text().trim()
    return h1 || null
  }

  extractHtmlText = ($: any): string => {
    const main = $("#pageContent, #content, main").first()
    if (!main.length) return ""

    return main
      .clone()
      .find(
        `
        nav,
        footer,
        header,
        script,
        style,
        aside,
        .breadcrumbs,
        .slideshow,
        .slick-slider,
        .carousel,
        .quicklinks,
        .search,
        .skip-to-content,
        [aria-hidden="true"]
      `,
      )
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim()
  }

  /**
   * Extract page title, full text, and segments (heading + text with start/end in full text)
   * so we can assign a heading to each chunk by position.
   */
  extractHtmlStructured = ($: any): ExtractHtmlStructuredResult | null => {
    const main = $("#pageContent, #content, main").first()
    if (!main.length) return null

    const clone = main
      .clone()
      .find(
        `
        nav,
        footer,
        header,
        script,
        style,
        aside,
        .breadcrumbs,
        .slideshow,
        .slick-slider,
        .carousel,
        .quicklinks,
        .search,
        .skip-to-content,
        [aria-hidden="true"]
      `,
      )
      .remove()
      .end()

    const title = this.extractHtmlTitle($)

    // Walk main content in document order; split on h1/h2/h3/h4 to build segments
    const segments: { heading: string | null; text: string }[] = []
    let current: { heading: string | null; text: string } = {
      heading: null,
      text: "",
    }
    const visit = (el: any) => {
      if (!el) return
      if (el.type === "text") {
        current.text += (el.data ?? "").replace(/\s+/g, " ")
        return
      }
      if (el.type !== "tag") return
      const tag = (el.name ?? "").toLowerCase()
      if (["h1", "h2", "h3", "h4"].includes(tag)) {
        if (current.text.trim()) {
          segments.push({
            heading: current.heading,
            text: current.text.replace(/\s+/g, " ").trim(),
          })
        }
        current = {
          heading: ($(el).text() ?? "").replace(/\s+/g, " ").trim() || null,
          text: "",
        }
        return
      }
      const children = el.childNodes ?? []
      for (const child of children) visit(child)
    }
    const root = clone.get(0)
    if (root?.childNodes) {
      for (const child of root.childNodes) visit(child)
    }
    if (current.text.trim()) {
      segments.push({
        heading: current.heading,
        text: current.text.replace(/\s+/g, " ").trim(),
      })
    }

    // If no segments (e.g. empty main), fall back to single segment from full text
    if (segments.length === 0) {
      const text = clone.text().replace(/\s+/g, " ").trim()
      if (text) segments.push({ heading: null, text })
    }

    // Build full text and segment ranges (startIndex/endIndex in full text)
    const parts: string[] = []
    const finalSegments: HtmlSegment[] = []
    let pos = 0
    for (const seg of segments) {
      const normalized = seg.text.replace(/\s+/g, " ").trim()
      if (!normalized) continue
      const startIndex = pos
      parts.push(normalized)
      pos += normalized.length
      finalSegments.push({
        heading: seg.heading,
        text: normalized,
        startIndex,
        endIndex: pos,
      })
      pos += 2 // "\n\n" between segments
    }
    // Keep join as-is so segment startIndex/endIndex match the actual text
    const text = parts.join("\n\n")

    return { title, text, segments: finalSegments }
  }

  extractPdfText = async (url: string): Promise<ExtractPdfResult> => {
    const parser = new PDFParse({ url })
    const parsedPdf = await parser.getText()
    const pageMap: PageRange[] = []
    const parts: string[] = []
    let pos = 0

    for (const page of parsedPdf.pages ?? []) {
      const normalized = (page.text ?? "").replace(/\s+/g, " ").trim()
      if (!normalized) continue
      if (parts.length > 0) {
        pos += 1 // space joiner between pages
      }
      const startIndex = pos
      parts.push(normalized)
      pos += normalized.length
      pageMap.push({
        page: page.num,
        startIndex,
        endIndex: pos,
      })
    }

    const text =
      parts.length > 0
        ? parts.join(" ")
        : (parsedPdf.text ?? "").replace(/\s+/g, " ").trim()

    return { text, pageMap }
  }

  chunkText(text: string): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      const end = start + CHUNK_SIZE
      chunks.push(text.slice(start, end))
      start = end - OVERLAP
      if (start < 0) start = 0
    }

    return chunks.map((c) => c.trim()).filter(Boolean)
  }

  /**
   * Chunk text and assign each chunk the heading of the segment that contains its start index.
   * segments must have startIndex/endIndex in the same text. If segments is empty, all headings are null.
   */
  chunkTextWithHeadings(
    text: string,
    segments: HtmlSegment[],
  ): ChunkWithMeta[] {
    const chunks = this.chunkText(text)
    const result: ChunkWithMeta[] = []
    let chunkStart = 0
    for (const content of chunks) {
      const heading = this.getHeadingForOffset(segments, chunkStart)
      result.push({
        content,
        heading,
        pageStart: null,
        pageEnd: null,
      })
      chunkStart += CHUNK_SIZE - OVERLAP
      if (chunkStart < 0) chunkStart = 0
    }
    return result
  }

  /**
   * Chunk PDF text and assign pageStart/pageEnd from a pageMap built during extraction.
   */
  chunkTextWithPages(text: string, pageMap: PageRange[]): ChunkWithMeta[] {
    const chunks = this.chunkText(text)
    const result: ChunkWithMeta[] = []
    let chunkStart = 0
    for (const content of chunks) {
      const chunkEnd = Math.min(chunkStart + content.length, text.length)
      const pageStart = this.getPageForOffset(pageMap, chunkStart)
      const pageEnd = this.getPageForOffset(
        pageMap,
        Math.max(chunkEnd - 1, chunkStart),
      )
      result.push({
        content,
        heading: null,
        pageStart,
        pageEnd,
      })
      chunkStart += CHUNK_SIZE - OVERLAP
      if (chunkStart < 0) chunkStart = 0
    }
    return result
  }

  private getHeadingForOffset(
    segments: HtmlSegment[],
    offset: number,
  ): string | null {
    for (const seg of segments) {
      if (offset >= seg.startIndex && offset < seg.endIndex) return seg.heading
    }
    return segments.length > 0 ? segments[segments.length - 1]!.heading : null
  }

  private getPageForOffset(
    pageMap: PageRange[],
    offset: number,
  ): number | null {
    if (pageMap.length === 0) return null
    for (const range of pageMap) {
      if (offset >= range.startIndex && offset < range.endIndex) {
        return range.page
      }
    }
    // Past last range (e.g. trailing whitespace) → last page
    return pageMap[pageMap.length - 1]!.page
  }
}
