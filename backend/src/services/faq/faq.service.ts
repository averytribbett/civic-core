import { randomUUID } from "node:crypto"
import pgvector from "pgvector"
import { prisma } from "../../lib/prisma"
import type { ChatSource } from "../../lib/types/chat-source.types"
import { EmbeddingService } from "../embedding.service"

export const FAQ_SIMILARITY_THRESHOLD = 0.85

export type FaqListItem = {
  id: string
  question: string
}

export type CachedFaq = {
  id: string
  question: string
  answer: string
  sources: ChatSource[]
  model: string | null
}

export type FaqUpsertRow = {
  question: string
  normalizedQuestion: string
  answer: string
  sources: ChatSource[]
  model: string | null
  embedding: number[]
  sourceUrl: string
}

export function normalizeFaqQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function isEnglishChatLanguage(
  language: string | undefined | null,
): boolean {
  if (!language || !language.trim()) return true
  return language.trim().toLowerCase().startsWith("en")
}

export function pickBestUnusedFaq<T extends { id: string; similarity: number }>(
  hits: T[],
  usedFaqIds: readonly string[],
  threshold: number = FAQ_SIMILARITY_THRESHOLD,
): T | null {
  const used = new Set(usedFaqIds)
  let best: T | null = null
  for (const hit of hits) {
    if (used.has(hit.id)) continue
    if (hit.similarity < threshold) continue
    if (!best || hit.similarity > best.similarity) best = hit
  }
  return best
}

function parseSources(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is ChatSource => {
    return Boolean(item && typeof item === "object" && "url" in item)
  })
}

export class FaqService {
  private readonly jurisdictionId: string

  constructor(jurisdictionId: string) {
    this.jurisdictionId = jurisdictionId
  }

  async listQuestions(): Promise<FaqListItem[]> {
    return prisma.faqEntry.findMany({
      where: { jurisdictionId: this.jurisdictionId },
      select: { id: true, question: true },
      orderBy: { question: "asc" },
    })
  }

  async findById(faqId: string): Promise<CachedFaq | null> {
    const row = await prisma.faqEntry.findFirst({
      where: { id: faqId, jurisdictionId: this.jurisdictionId },
      select: {
        id: true,
        question: true,
        answer: true,
        sources: true,
        model: true,
      },
    })
    if (!row) return null
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      sources: parseSources(row.sources),
      model: row.model,
    }
  }

  async loadUsedFaqIds(conversationId: string | null): Promise<string[]> {
    if (!conversationId) return []
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, jurisdictionId: this.jurisdictionId },
      select: { usedFaqIds: true },
    })
    return existing?.usedFaqIds ?? []
  }

  async matchByEmbedding(
    queryEmbedding: number[],
    usedFaqIds: string[],
    threshold: number = FAQ_SIMILARITY_THRESHOLD,
  ): Promise<CachedFaq | null> {
    const embeddingSql = pgvector.toSql(queryEmbedding)
    const params: unknown[] = [embeddingSql, this.jurisdictionId, threshold]
    let usedClause = ""
    if (usedFaqIds.length > 0) {
      usedClause = ` AND NOT (id = ANY($4::text[]))`
      params.push(usedFaqIds)
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        question: string
        answer: string
        sources: unknown
        model: string | null
        similarity: number
      }>
    >(
      `
        SELECT
          id,
          question,
          answer,
          sources,
          model,
          1 - ("questionEmbedding" <=> $1::vector) as similarity
        FROM "faq_entries"
        WHERE "jurisdictionId" = $2
          AND 1 - ("questionEmbedding" <=> $1::vector) >= $3
          ${usedClause}
        ORDER BY "questionEmbedding" <=> $1::vector
        LIMIT 1
      `,
      ...params,
    )

    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      sources: parseSources(row.sources),
      model: row.model,
    }
  }

  async resolve(opts: {
    message: string
    faqId?: string | null
    usedFaqIds: string[]
  }): Promise<CachedFaq | null> {
    const faqId = opts.faqId?.trim()
    if (faqId) {
      if (opts.usedFaqIds.includes(faqId)) return null
      const byId = await this.findById(faqId)
      if (byId) return byId
    }

    const embeddingService = new EmbeddingService()
    const queryEmbedding = await embeddingService.generateEmbedding(
      opts.message,
    )
    return this.matchByEmbedding(queryEmbedding, opts.usedFaqIds)
  }

  async replaceEntries(rows: FaqUpsertRow[]): Promise<string[]> {
    const now = new Date()
    const keptIds: string[] = []

    for (const row of rows) {
      const existing = await prisma.faqEntry.findFirst({
        where: {
          jurisdictionId: this.jurisdictionId,
          normalizedQuestion: row.normalizedQuestion,
        },
        select: { id: true },
      })
      const id = existing?.id ?? randomUUID()
      const embeddingSql = pgvector.toSql(row.embedding)
      const sourcesJson = JSON.stringify(row.sources)

      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "faq_entries" (
            "id", "jurisdictionId", "question", "normalizedQuestion", "answer",
            "sources", "model", "questionEmbedding", "sourceUrl", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::vector, $9, $10, $11)
          ON CONFLICT ("jurisdictionId", "normalizedQuestion")
          DO UPDATE SET
            "question" = EXCLUDED."question",
            "answer" = EXCLUDED."answer",
            "sources" = EXCLUDED."sources",
            "model" = EXCLUDED."model",
            "questionEmbedding" = EXCLUDED."questionEmbedding",
            "sourceUrl" = EXCLUDED."sourceUrl",
            "updatedAt" = EXCLUDED."updatedAt"
        `,
        id,
        this.jurisdictionId,
        row.question,
        row.normalizedQuestion,
        row.answer,
        sourcesJson,
        row.model,
        embeddingSql,
        row.sourceUrl,
        now,
        now,
      )
      keptIds.push(id)
    }

    if (keptIds.length === 0) {
      await prisma.faqEntry.deleteMany({
        where: { jurisdictionId: this.jurisdictionId },
      })
      return []
    }

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM "faq_entries"
        WHERE "jurisdictionId" = $1
          AND NOT (id = ANY($2::text[]))
      `,
      this.jurisdictionId,
      keptIds,
    )

    return keptIds
  }
}
