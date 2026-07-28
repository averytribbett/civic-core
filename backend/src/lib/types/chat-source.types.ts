/** Structured citation returned with chat responses and stored on agent messages. */
export type ChatSource = {
  citationIndex: number
  url: string
  title: string | null
  heading: string | null
  chunkIndex: number
  pageStart: number | null
  pageEnd: number | null
  mimeType: string | null
  snippet: string
  href: string
}
