// We use this type because embedding is unsupported by Prisma
export type IngestChunk = {
  content: string
  embedding: number[]
  chunkIndex: number
  heading?: string
  charCount?: number
  pageStart?: number | null
  pageEnd?: number | null
}
