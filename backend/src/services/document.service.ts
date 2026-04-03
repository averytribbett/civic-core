import { PrismaClient } from "../generated/prisma/client"
import { IngestChunk } from "../lib/types/document.types"
import pgvector from "pgvector"
import { randomUUID } from "node:crypto"
import { prisma } from "../lib/prisma"
import { DocumentHashService } from "./document-hash.service"
import { EmbeddingService } from "./embedding.service"
import type { HtmlSegment } from "./text-processing.service"
import { TextProcessingService } from "./text-processing.service"

export type UpsertDocumentInput = {
  source: string
  documents: {
    url: string
    text: string
    title?: string | null
    segments?: HtmlSegment[]
  }[]
}

export type UpsertDocumentsResult = {
  created: number
  updated: number
  deleted: number
  skipped: number
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
   * @param source - Optional source filter to limit search to specific document source
   * @returns Array of chunks with their similarity scores and document metadata
   */
  async searchSimilarChunks(
    queryEmbedding: number[],
    limit: number = 5,
    similarityThreshold: number = 0.5,
    source?: string,
  ): Promise<
    Array<{
      id: string
      chunkIndex: number
      content: string
      heading: string | null
      similarity: number
      document: {
        id: string
        url: string
        title: string | null
        source: string | null
      }
    }>
  > {
    try {
      // Convert embedding array to pgvector SQL format
      // pgvector.toSql() returns '[1,2,3]' format
      const embeddingSql = pgvector.toSql(queryEmbedding)

      // Use the vector as a parameter to avoid SQL injection and syntax issues
      // Pass it as the first parameter and cast it to vector type in SQL
      let query = `
        SELECT 
          c.id,
          c."chunkIndex" as "chunkIndex",
          c.content,
          c.heading,
          1 - (c.embedding <=> $1::vector) as similarity,
          d.id as "documentId",
          d.url as "documentUrl",
          d.title as "documentTitle",
          d.source as "documentSource"
        FROM "chunks" c
        INNER JOIN "documents" d ON c."documentId" = d.id
        WHERE 1 - (c.embedding <=> $1::vector) >= $2
      `

      const params: any[] = [embeddingSql, similarityThreshold]
      let paramIndex = 3

      if (source) {
        query += ` AND d.source = $${paramIndex}`
        params.push(source)
        paramIndex++
      }

      query += ` ORDER BY c.embedding <=> $1::vector LIMIT $${paramIndex}`
      params.push(limit)

      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string
          chunkIndex: number
          content: string
          heading: string | null
          similarity: number
          documentId: string
          documentUrl: string
          documentTitle: string | null
          documentSource: string | null
        }>
      >(query, ...params)

      return results.map((row) => ({
        id: row.id,
        chunkIndex: row.chunkIndex,
        content: row.content,
        heading: row.heading,
        similarity: parseFloat(row.similarity.toString()),
        document: {
          id: row.documentId,
          url: row.documentUrl,
          title: row.documentTitle,
          source: row.documentSource,
        },
      }))
    } catch (error: any) {
      console.error("Error searching similar chunks:", error)
      throw new Error(`Failed to search similar chunks: ${error.message}`)
    }
  }

  /**
   * Fetch chunks by (documentId, chunkIndex) pairs (e.g. for ±1 adjacent context).
   * Returns chunks with document metadata; similarity is 0 since these are not from vector search.
   */
  async getChunksByDocumentAndIndices(
    pairs: Array<{ documentId: string; chunkIndex: number }>,
    source?: string,
  ): Promise<
    Array<{
      id: string
      chunkIndex: number
      content: string
      heading: string | null
      similarity: number
      document: {
        id: string
        url: string
        title: string | null
        source: string | null
      }
    }>
  > {
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
        ...(source ? { document: { source } } : {}),
      },
      include: { document: true },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    })
    return chunks.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      heading: c.heading,
      similarity: 0,
      document: {
        id: c.document.id,
        url: c.document.url,
        title: c.document.title,
        source: c.document.source,
      },
    }))
  }

  async upsertDocuments(
    input: UpsertDocumentInput,
  ): Promise<UpsertDocumentsResult> {
    const DOCUMENT_BATCH_SIZE = 100
    const counts: UpsertDocumentsResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
    }
    const newDocumentUrls = new Set(input.documents.map((d) => d.url))
    const existingDocuments = await this.prisma.document.findMany({
      where: { url: { in: input.documents.map((d) => d.url) } },
    })
    const existingByUrl = new Map(
      existingDocuments.map((d) => [d.url, { id: d.id, hash: d.hash ?? "" }]),
    )
    // All documents for this source (used later to delete stale URLs not in this crawl)
    const allDocumentsForSource = await this.prisma.document.findMany({
      where: { source: input.source },
      select: { id: true, url: true },
    })

    const totalBatches = Math.ceil(input.documents.length / DOCUMENT_BATCH_SIZE)
    for (let i = 0; i < input.documents.length; i += DOCUMENT_BATCH_SIZE) {
      const batchIndex = Math.floor(i / DOCUMENT_BATCH_SIZE) + 1
      const batch = input.documents.slice(i, i + DOCUMENT_BATCH_SIZE)
      const documentsToCreate: typeof batch = []
      const documentsToUpdate: typeof batch = []

      for (const doc of batch) {
        const hash = this.documentHashService.makeDocumentHash({
          url: doc.url,
          text: doc.text,
        })
        const existing = existingByUrl.get(doc.url)
        if (!existing) {
          documentsToCreate.push(doc)
        } else if (existing.hash !== hash) {
          documentsToUpdate.push(doc)
        }
      }

      // Compute chunks and embeddings outside the transaction (no DB, keeps tx short)
      type DocWithChunks = {
        doc: (typeof batch)[0]
        hash: string
        ingestChunks: IngestChunk[]
      }
      const toCreate: DocWithChunks[] = []
      for (const doc of documentsToCreate) {
        try {
          const hash = this.documentHashService.makeDocumentHash({
            url: doc.url,
            text: doc.text,
          })
          const trimmed = doc.text.trim()
          const withHeadings =
            doc.segments && doc.segments.length > 0
              ? this.textProcessingService.chunkTextWithHeadings(
                  trimmed,
                  doc.segments,
                )
              : this.textProcessingService
                  .chunkText(trimmed)
                  .filter(Boolean)
                  .map((content) => ({ content, heading: null as string | null }))
          if (withHeadings.length === 0) continue
          const textChunks = withHeadings.map((c) => c.content)
          const embeddings =
            await this.embeddingService.generateEmbeddings(textChunks)
          const ingestChunks: IngestChunk[] = withHeadings.map((c, idx) => ({
            content: c.content,
            embedding: embeddings[idx]!,
            chunkIndex: idx,
            heading: c.heading ?? undefined,
            tokens: c.content.length,
          }))
          toCreate.push({ doc, hash, ingestChunks })
        } catch (err: any) {
          const isTokenLimit =
            err?.status === 400 &&
            (err?.message?.includes("maximum context length") ||
              err?.message?.includes("8192 tokens"))
          if (isTokenLimit) {
            console.warn(`Page skipped (embedding token limit): ${doc.url}`)
            continue
          }
          throw err
        }
      }

      const toUpdate: DocWithChunks[] = []
      for (const doc of documentsToUpdate) {
        try {
          const hash = this.documentHashService.makeDocumentHash({
            url: doc.url,
            text: doc.text,
          })
          const trimmed = doc.text.trim()
          const withHeadings =
            doc.segments && doc.segments.length > 0
              ? this.textProcessingService.chunkTextWithHeadings(
                  trimmed,
                  doc.segments,
                )
              : this.textProcessingService
                  .chunkText(trimmed)
                  .filter(Boolean)
                  .map((content) => ({ content, heading: null as string | null }))
          if (withHeadings.length === 0) {
            toUpdate.push({ doc, hash, ingestChunks: [] })
            continue
          }
          const textChunks = withHeadings.map((c) => c.content)
          const embeddings =
            await this.embeddingService.generateEmbeddings(textChunks)
          const ingestChunks: IngestChunk[] = withHeadings.map((c, idx) => ({
            content: c.content,
            embedding: embeddings[idx]!,
            chunkIndex: idx,
            heading: c.heading ?? undefined,
            tokens: c.content.length,
          }))
          toUpdate.push({ doc, hash, ingestChunks })
        } catch (err: any) {
          const isTokenLimit =
            err?.status === 400 &&
            (err?.message?.includes("maximum context length") ||
              err?.message?.includes("8192 tokens"))
          if (isTokenLimit) {
            console.warn(`Page skipped (embedding token limit): ${doc.url}`)
            continue
          }
          throw err
        }
      }

      counts.skipped +=
        batch.length - documentsToCreate.length - documentsToUpdate.length
      counts.created += toCreate.length
      counts.updated += toUpdate.length

      // One transaction per batch: all creates, updates, deletes, and chunk inserts commit together
      await this.prisma.$transaction(async (tx) => {
        for (const { doc, hash, ingestChunks } of toCreate) {
          const created = await tx.document.create({
            data: {
              url: this.sanitizeTextForDb(doc.url) ?? doc.url,
              source: this.sanitizeTextForDb(input.source) ?? input.source,
              title: this.sanitizeTextForDb(doc.title ?? null),
              hash: this.sanitizeTextForDb(hash) ?? hash,
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
              hash: this.sanitizeTextForDb(hash) ?? hash,
              title: this.sanitizeTextForDb(doc.title ?? null),
            },
          })
          if (ingestChunks.length > 0) {
            await this.insertChunks(tx, existing.id, ingestChunks)
          }
          existingByUrl.set(doc.url, { id: existing.id, hash })
        }
      })

      console.log(`upsertDocuments batch ${batchIndex}/${totalBatches} done`, {
        batchCreated: toCreate.length,
        batchUpdated: toUpdate.length,
        batchSkipped:
          batch.length - documentsToCreate.length - documentsToUpdate.length,
        runningTotal: {
          created: counts.created,
          updated: counts.updated,
          skipped: counts.skipped,
        },
      })
    }

    const idsToDelete = allDocumentsForSource
      .filter((d) => !newDocumentUrls.has(d.url))
      .map((d) => d.id)
    if (idsToDelete.length > 0) {
      await this.prisma.document.deleteMany({
        where: { id: { in: idsToDelete } },
      })
      counts.deleted = idsToDelete.length
    }

    return counts
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
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}::vector, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8})`,
      )
      params.push(
        id,
        documentId,
        c.chunkIndex,
        this.sanitizeTextForDb(c.content) ?? "",
        embeddingSql,
        this.sanitizeTextForDb(c.heading ?? null),
        c.tokens ?? null,
        now,
        now,
      )
      idx += 9
    }
    const query = `
      INSERT INTO "chunks" ("id", "documentId", "chunkIndex", "content", "embedding", "heading", "tokens", "createdAt", "updatedAt")
      VALUES ${placeholders.join(", ")}
    `
    await client.$executeRawUnsafe(query, ...params)
  }
}
