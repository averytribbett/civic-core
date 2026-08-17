import { PrismaClient } from "../generated/prisma/client"
import {
  classifyDocumentKind,
  type DocumentKind,
} from "../lib/document-kind"
import { IngestChunk } from "../lib/types/document.types"
import pgvector from "pgvector"
import { randomUUID } from "node:crypto"
import { mapPool } from "../lib/concurrency"
import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"
import { DocumentHashService } from "./document-hash.service"
import { EmbeddingService } from "./embedding.service"
import type { HtmlSegment, PageRange, ChunkWithMeta } from "./text-processing.service"
import { TextProcessingService } from "./text-processing.service"

const EMBEDDING_BATCH_SIZE = 100
const EMBEDDING_API_CONCURRENCY = 3

type CrawlDocument = UpsertDocumentInput["documents"][number]

type DocWithChunks = {
  doc: CrawlDocument
  hash: string
  ingestChunks: IngestChunk[]
}

export type UpsertDocumentInput = {
  jurisdictionId: string
  documents: {
    url: string
    text: string
    title?: string | null
    segments?: HtmlSegment[]
    pageMap?: PageRange[]
    mimeType?: string | null
    docKind?: DocumentKind | null
  }[]
}

export type SimilarChunkResult = {
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
    jurisdictionId: string
    mimeType: string | null
    docKind: DocumentKind | null
  }
}

export type UpsertDocumentsResult = {
  created: number
  updated: number
  deleted: number
  skipped: number
}

export function dedupeDocumentsByUrl<T extends { url: string }>(
  documents: T[],
): {
  documents: T[]
  skipped: number
} {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const doc of documents) {
    if (seen.has(doc.url)) continue
    seen.add(doc.url)
    unique.push(doc)
  }

  return {
    documents: unique,
    skipped: documents.length - unique.length,
  }
}

export class DocumentService {
  private readonly prisma: PrismaClient
  private readonly documentHashService: DocumentHashService
  private readonly embeddingService: EmbeddingService
  private readonly textProcessingService: TextProcessingService

  constructor() {
    this.prisma = prisma
    this.documentHashService = new DocumentHashService()
    this.embeddingService = new EmbeddingService()
    this.textProcessingService = new TextProcessingService()
  }

  /**
   * Search for similar chunks using vector similarity
   * @param queryEmbedding - The embedding vector of the query (number[])
   * @param limit - Maximum number of chunks to return (default: 5)
   * @param similarityThreshold - Minimum cosine similarity threshold (default: 0.5)
   * @param jurisdictionId - Optional jurisdiction filter to limit search scope
   * @param options.excludeMeetingDumps - When true (default), exclude agenda/minutes
   *   docKind so service pages can enter the candidate set
   * @returns Array of chunks with their similarity scores and document metadata
   */
  async searchSimilarChunks(
    queryEmbedding: number[],
    limit: number = 5,
    similarityThreshold: number = 0.5,
    jurisdictionId?: string,
    options?: { excludeMeetingDumps?: boolean },
  ): Promise<SimilarChunkResult[]> {
    try {
      // Convert embedding array to pgvector SQL format
      // pgvector.toSql() returns '[1,2,3]' format
      const embeddingSql = pgvector.toSql(queryEmbedding)
      const excludeMeetingDumps = options?.excludeMeetingDumps ?? true

      // Use the vector as a parameter to avoid SQL injection and syntax issues
      // Pass it as the first parameter and cast it to vector type in SQL
      let query = `
        SELECT 
          c.id,
          c."chunkIndex" as "chunkIndex",
          c.content,
          c.heading,
          c."pageStart" as "pageStart",
          c."pageEnd" as "pageEnd",
          1 - (c.embedding <=> $1::vector) as similarity,
          d.id as "documentId",
          d.url as "documentUrl",
          d.title as "documentTitle",
          d."jurisdictionId" as "documentJurisdictionId",
          d."mimeType" as "documentMimeType",
          d."docKind" as "documentDocKind"
        FROM "chunks" c
        INNER JOIN "documents" d ON c."documentId" = d.id
        WHERE 1 - (c.embedding <=> $1::vector) >= $2
      `

      const params: any[] = [embeddingSql, similarityThreshold]
      let paramIndex = 3

      if (jurisdictionId) {
        query += ` AND d."jurisdictionId" = $${paramIndex}`
        params.push(jurisdictionId)
        paramIndex++
      }

      if (excludeMeetingDumps) {
        query += ` AND d."docKind" NOT IN ('agenda', 'minutes')`
      }

      query += ` ORDER BY c.embedding <=> $1::vector LIMIT $${paramIndex}`
      params.push(limit)

      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string
          chunkIndex: number
          content: string
          heading: string | null
          pageStart: number | null
          pageEnd: number | null
          similarity: number
          documentId: string
          documentUrl: string
          documentTitle: string | null
          documentJurisdictionId: string
          documentMimeType: string | null
          documentDocKind: DocumentKind | null
        }>
      >(query, ...params)

      return results.map((row) => ({
        id: row.id,
        chunkIndex: row.chunkIndex,
        content: row.content,
        heading: row.heading,
        pageStart: row.pageStart,
        pageEnd: row.pageEnd,
        similarity: parseFloat(row.similarity.toString()),
        document: {
          id: row.documentId,
          url: row.documentUrl,
          title: row.documentTitle,
          jurisdictionId: row.documentJurisdictionId,
          mimeType: row.documentMimeType,
          docKind: row.documentDocKind,
        },
      }))
    } catch (error: any) {
      logger.error("Error searching similar chunks:", error)
      throw new Error(`Failed to search similar chunks: ${error.message}`)
    }
  }

  /**
   * Fetch chunks by (documentId, chunkIndex) pairs (e.g. for ±1 adjacent context).
   * Returns chunks with document metadata; similarity is 0 since these are not from vector search.
   */
  async getChunksByDocumentAndIndices(
    pairs: Array<{ documentId: string; chunkIndex: number }>,
    jurisdictionId?: string,
  ): Promise<SimilarChunkResult[]> {
    if (pairs.length === 0) return []
    const seen = new Set<string>()
    const uniquePairs = pairs.filter((p) => {
      const key = `${p.documentId}:${p.chunkIndex}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const chunks = await this.prisma.chunk.findMany({
      where: {
        OR: uniquePairs.map((p) => ({
          documentId: p.documentId,
          chunkIndex: p.chunkIndex,
        })),
        ...(jurisdictionId ? { document: { jurisdictionId } } : {}),
      },
      include: { document: true },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    })
    return chunks.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      heading: c.heading,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      similarity: 0,
      document: {
        id: c.document.id,
        url: c.document.url,
        title: c.document.title,
        jurisdictionId: c.document.jurisdictionId,
        mimeType: c.document.mimeType,
        docKind: c.document.docKind as DocumentKind | null,
      },
    }))
  }

  /**
   * Upsert a batch of crawled documents (no stale-url deletion).
   * Used during pipelined crawl; pass `existingByUrl` across flushes on the same crawl.
   */
  async upsertDocumentsBatch(
    input: UpsertDocumentInput,
    existingByUrl: Map<string, { id: string; hash: string }>,
  ): Promise<UpsertDocumentsResult> {
    const counts: UpsertDocumentsResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
    }
    if (input.documents.length === 0) return counts

    const { documents, skipped } = dedupeDocumentsByUrl(input.documents)
    counts.skipped += skipped

    const urls = documents.map((d) => d.url)
    const missingUrls = urls.filter((u) => !existingByUrl.has(u))
    if (missingUrls.length > 0) {
      const found = await this.prisma.document.findMany({
        where: { url: { in: missingUrls } },
        select: { id: true, url: true, hash: true },
      })
      for (const d of found) {
        existingByUrl.set(d.url, { id: d.id, hash: d.hash ?? "" })
      }
    }

    const documentsToCreate: CrawlDocument[] = []
    const documentsToUpdate: CrawlDocument[] = []
    const metadataOnlyUpdates: CrawlDocument[] = []

    for (const doc of documents) {
      const hash = this.documentHashService.makeDocumentHash({
        url: doc.url,
        text: doc.text,
      })
      const enriched = this.enrichDocumentMeta(doc)
      const existing = existingByUrl.get(doc.url)
      if (!existing) {
        documentsToCreate.push(enriched)
      } else if (existing.hash !== hash) {
        documentsToUpdate.push(enriched)
      } else {
        metadataOnlyUpdates.push(enriched)
      }
    }

    const toCreate = await this.buildDocsWithEmbeddings(
      documentsToCreate,
      "create",
    )
    const toUpdate = await this.buildDocsWithEmbeddings(
      documentsToUpdate,
      "update",
    )

    counts.skipped +=
      documents.length - toCreate.length - toUpdate.length
    counts.created += toCreate.length
    counts.updated += toUpdate.length

    await this.prisma.$transaction(async (tx) => {
      for (const { doc, hash, ingestChunks } of toCreate) {
        const created = await tx.document.create({
          data: {
            url: this.sanitizeTextForDb(doc.url) ?? doc.url,
            jurisdictionId: input.jurisdictionId,
            title: this.sanitizeTextForDb(doc.title ?? null),
            hash: this.sanitizeTextForDb(hash) ?? hash,
            mimeType: this.sanitizeTextForDb(doc.mimeType ?? null),
            docKind: doc.docKind ?? null,
          },
        })
        if (ingestChunks.length > 0) {
          await this.insertChunks(tx, created.id, ingestChunks)
        }
        existingByUrl.set(doc.url, { id: created.id, hash })
      }

      for (const { doc, hash, ingestChunks } of toUpdate) {
        const existing = existingByUrl.get(doc.url)!
        await tx.chunk.deleteMany({ where: { documentId: existing.id } })
        await tx.document.update({
          where: { id: existing.id },
          data: {
            jurisdictionId: input.jurisdictionId,
            hash: this.sanitizeTextForDb(hash) ?? hash,
            title: this.sanitizeTextForDb(doc.title ?? null),
            mimeType: this.sanitizeTextForDb(doc.mimeType ?? null),
            docKind: doc.docKind ?? null,
          },
        })
        if (ingestChunks.length > 0) {
          await this.insertChunks(tx, existing.id, ingestChunks)
        }
        existingByUrl.set(doc.url, { id: existing.id, hash })
      }

      for (const doc of metadataOnlyUpdates) {
        const existing = existingByUrl.get(doc.url)!
        await tx.document.update({
          where: { id: existing.id },
          data: {
            jurisdictionId: input.jurisdictionId,
            title: this.sanitizeTextForDb(doc.title ?? null),
            mimeType: this.sanitizeTextForDb(doc.mimeType ?? null),
            docKind: doc.docKind ?? null,
          },
        })
      }
    })

    return counts
  }

  /** Ensure mimeType/docKind are set from crawl input or URL/title heuristics. */
  private enrichDocumentMeta(doc: CrawlDocument): CrawlDocument {
    const mimeType = doc.mimeType ?? null
    const docKind =
      doc.docKind ??
      classifyDocumentKind({
        url: doc.url,
        title: doc.title,
        mimeType,
      })
    return { ...doc, mimeType, docKind }
  }

  /** Remove documents for a jurisdiction whose URLs were not seen in the completed crawl. */
  async deleteStaleDocuments(
    jurisdictionId: string,
    crawledUrls: Set<string>,
  ): Promise<number> {
    const allDocumentsForSource = await this.prisma.document.findMany({
      where: { jurisdictionId },
      select: { id: true, url: true },
    })
    const idsToDelete = allDocumentsForSource
      .filter((d) => !crawledUrls.has(d.url))
      .map((d) => d.id)
    if (idsToDelete.length === 0) return 0
    await this.prisma.document.deleteMany({
      where: { id: { in: idsToDelete } },
    })
    return idsToDelete.length
  }

  async upsertDocuments(
    input: UpsertDocumentInput,
  ): Promise<UpsertDocumentsResult> {
    const DOCUMENT_BATCH_SIZE = 100
    const existingByUrl = new Map<string, { id: string; hash: string }>()
    const totals: UpsertDocumentsResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
    }

    for (let i = 0; i < input.documents.length; i += DOCUMENT_BATCH_SIZE) {
      const batch = input.documents.slice(i, i + DOCUMENT_BATCH_SIZE)
      const result = await this.upsertDocumentsBatch(
        { jurisdictionId: input.jurisdictionId, documents: batch },
        existingByUrl,
      )
      totals.created += result.created
      totals.updated += result.updated
      totals.skipped += result.skipped
    }

    totals.deleted = await this.deleteStaleDocuments(
      input.jurisdictionId,
      new Set(input.documents.map((d) => d.url)),
    )
    return totals
  }

  private chunkDocument(doc: CrawlDocument): ChunkWithMeta[] {
    const trimmed = doc.text.trim()
    if (!trimmed) return []
    if (doc.pageMap && doc.pageMap.length > 0) {
      return this.textProcessingService.chunkTextWithPages(trimmed, doc.pageMap)
    }
    if (doc.segments && doc.segments.length > 0) {
      return this.textProcessingService.chunkTextWithHeadings(
        trimmed,
        doc.segments,
      )
    }
    return this.textProcessingService.chunkText(trimmed).map((content) => ({
      content,
      heading: null as string | null,
      pageStart: null,
      pageEnd: null,
    }))
  }

  private isEmbeddingTokenLimitError(err: unknown): boolean {
    const e = err as { status?: number; message?: string }
    return (
      e?.status === 400 &&
      Boolean(
        e?.message?.includes("maximum context length") ||
        e?.message?.includes("8192 tokens"),
      )
    )
  }

  /**
   * Chunk all docs, embed texts in global batches (parallel API calls), map back per document.
   */
  private async buildDocsWithEmbeddings(
    docs: CrawlDocument[],
    mode: "create" | "update",
  ): Promise<DocWithChunks[]> {
    if (docs.length === 0) return []

    type PendingDoc = {
      doc: CrawlDocument
      hash: string
      chunks: ChunkWithMeta[]
    }

    const pending: PendingDoc[] = []
    for (const doc of docs) {
      const hash = this.documentHashService.makeDocumentHash({
        url: doc.url,
        text: doc.text,
      })
      const chunks = this.chunkDocument(doc)
      if (chunks.length === 0) {
        if (mode === "update") {
          pending.push({ doc, hash, chunks: [] })
        }
        continue
      }
      pending.push({ doc, hash, chunks })
    }

    const flatTexts: string[] = []
    const sliceRanges: Array<{ docIndex: number; start: number; end: number }> =
      []

    for (let docIndex = 0; docIndex < pending.length; docIndex++) {
      const { chunks } = pending[docIndex]!
      if (chunks.length === 0) continue
      const start = flatTexts.length
      for (const c of chunks) {
        flatTexts.push(c.content)
      }
      sliceRanges.push({ docIndex, start, end: flatTexts.length })
    }

    let flatEmbeddings: number[][] = []
    if (flatTexts.length > 0) {
      try {
        flatEmbeddings = await this.embedTextsInParallel(flatTexts)
      } catch (err: unknown) {
        if (!this.isEmbeddingTokenLimitError(err)) throw err
        logger.warn("Batch embedding hit token limit; retrying per document")
        return this.buildDocsWithEmbeddingsSequential(docs, mode)
      }
    }

    const result: DocWithChunks[] = []
    let rangeIdx = 0
    for (let docIndex = 0; docIndex < pending.length; docIndex++) {
      const { doc, hash, chunks } = pending[docIndex]!
      if (chunks.length === 0) {
        result.push({ doc, hash, ingestChunks: [] })
        continue
      }
      const range = sliceRanges[rangeIdx]!
      rangeIdx++
      const docEmbeddings = flatEmbeddings.slice(range.start, range.end)
      const ingestChunks: IngestChunk[] = chunks.map((c, idx) => ({
        content: c.content,
        embedding: docEmbeddings[idx]!,
        chunkIndex: idx,
        heading: c.heading ?? undefined,
        charCount: c.content.length,
        pageStart: c.pageStart ?? null,
        pageEnd: c.pageEnd ?? null,
      }))
      result.push({ doc, hash, ingestChunks })
    }

    return result
  }

  private async buildDocsWithEmbeddingsSequential(
    docs: CrawlDocument[],
    mode: "create" | "update",
  ): Promise<DocWithChunks[]> {
    const result: DocWithChunks[] = []
    for (const doc of docs) {
      try {
        const hash = this.documentHashService.makeDocumentHash({
          url: doc.url,
          text: doc.text,
        })
        const chunks = this.chunkDocument(doc)
        if (chunks.length === 0) {
          if (mode === "update") result.push({ doc, hash, ingestChunks: [] })
          continue
        }
        const embeddings = await this.embeddingService.generateEmbeddings(
          chunks.map((c) => c.content),
        )
        result.push({
          doc,
          hash,
          ingestChunks: chunks.map((c, idx) => ({
            content: c.content,
            embedding: embeddings[idx]!,
            chunkIndex: idx,
            heading: c.heading ?? undefined,
            charCount: c.content.length,
            pageStart: c.pageStart ?? null,
            pageEnd: c.pageEnd ?? null,
          })),
        })
      } catch (err: unknown) {
        if (this.isEmbeddingTokenLimitError(err)) {
          continue
        }
        throw err
      }
    }
    return result
  }

  /** Global OpenAI batches with limited parallel in-flight requests. */
  private async embedTextsInParallel(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    if (texts.length === 1) {
      return [await this.embeddingService.generateEmbedding(texts[0]!)]
    }

    const batchStarts: number[] = []
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      batchStarts.push(i)
    }

    const concurrency = EMBEDDING_API_CONCURRENCY
    const batchResults = await mapPool(batchStarts, concurrency, (start) => {
      const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE)
      return this.embeddingService.generateEmbeddings(batch)
    })

    return batchResults.flat()
  }

  /**
   * Strip bytes that PostgreSQL UTF-8 text doesn't allow (e.g. null 0x00).
   */
  private sanitizeTextForDb(value: string | null | undefined): string | null {
    if (value == null) return null
    return value.replace(/\0/g, "")
  }

  /**
   * Insert chunk rows with vector embeddings via raw SQL (Prisma does not support vector type).
   * Accepts transaction client so batch writes run inside the same transaction.
   */
  private async insertChunks(
    client: Pick<PrismaClient, "$executeRawUnsafe">,
    documentId: string,
    chunks: IngestChunk[],
  ): Promise<void> {
    if (chunks.length === 0) return
    const now = new Date()
    const placeholders: string[] = []
    const params: unknown[] = []
    let idx = 1
    for (const c of chunks) {
      const id = randomUUID()
      const embeddingSql = pgvector.toSql(c.embedding)
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}::vector, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10})`,
      )
      params.push(
        id,
        documentId,
        c.chunkIndex,
        this.sanitizeTextForDb(c.content) ?? "",
        embeddingSql,
        this.sanitizeTextForDb(c.heading ?? null),
        c.charCount ?? null,
        c.pageStart ?? null,
        c.pageEnd ?? null,
        now,
        now,
      )
      idx += 11
    }
    const query = `
      INSERT INTO "chunks" ("id", "documentId", "chunkIndex", "content", "embedding", "heading", "charCount", "pageStart", "pageEnd", "createdAt", "updatedAt")
      VALUES ${placeholders.join(", ")}
    `
    await client.$executeRawUnsafe(query, ...params)
  }
}
