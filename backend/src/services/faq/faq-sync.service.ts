import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { config } from "../../config"
import { buildChatPrompt } from "../../config/prompts"
import { mapPool } from "../../lib/concurrency"
import { createLogger } from "../../lib/logger"
import type { ChatSource } from "../../lib/types/chat-source.types"
import { ChatService } from "../agent/chat.service"
import { EmbeddingService } from "../embedding.service"
import {
  FaqService,
  normalizeFaqQuestion,
  usableFaqSources,
  type FaqUpsertRow,
} from "./faq.service"

const MAX_FAQS_PER_JURISDICTION = 20
const FAQ_FETCH_TIMEOUT_MS = 20_000
const FAQ_GENERATE_CONCURRENCY = 2
const LLM_PAGE_TEXT_CHARS = 40_000
const LLM_MAX_TOKENS = 2000

export type FaqSyncResult = {
  extracted: number
  stored: number
}

export type FaqRefreshResult = {
  total: number
  updated: number
  withSources: number
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text: unknown }).text === "string"
        ) {
          return (part as { text: string }).text
        }
        return ""
      })
      .join("")
  }
  return content == null ? "" : String(content)
}

export class FaqSyncService {
  private readonly jurisdictionId: string
  private readonly faqUrl: string
  private readonly prompt: string
  private readonly logSource: string

  constructor(
    jurisdictionId: string,
    faqUrl: string,
    prompt: string,
    logSource?: string,
  ) {
    this.jurisdictionId = jurisdictionId
    this.faqUrl = faqUrl
    this.prompt = prompt
    this.logSource = logSource ?? jurisdictionId
  }

  async sync(): Promise<FaqSyncResult> {
    const log = createLogger("faq-sync", this.logSource)
    const html = await this.fetchFaqPage()
    const pageText = this.visiblePageText(html)

    let questions: string[] = []
    try {
      questions = await this.extractQuestions(pageText)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      log.warn(`faq extract failed: ${err.message}`)
    }

    if (questions.length === 0) {
      log.warn("faq extract found no questions")
      return { extracted: 0, stored: 0 }
    }

    const generated = await mapPool(
      questions,
      FAQ_GENERATE_CONCURRENCY,
      async (question) => {
        const generatedAnswer = await this.generateAnswer(question, log)
        if (!generatedAnswer) return null
        return { question, ...generatedAnswer }
      },
    )

    const succeeded = generated.filter(
      (row): row is NonNullable<typeof row> => row != null,
    )
    if (succeeded.length === 0) {
      log.warn("faq generate stored none")
      return { extracted: questions.length, stored: 0 }
    }

    const embeddingService = new EmbeddingService()
    const embeddings = await embeddingService.generateEmbeddings(
      succeeded.map((row) => row.question),
    )

    const upserts: FaqUpsertRow[] = []
    for (let i = 0; i < succeeded.length; i++) {
      const row = succeeded[i]!
      const embedding = embeddings[i]
      if (!embedding) continue
      upserts.push({
        question: row.question,
        normalizedQuestion: normalizeFaqQuestion(row.question),
        answer: row.answer,
        sources: row.sources,
        model: row.model,
        embedding,
        sourceUrl: this.faqUrl,
      })
    }

    const faqService = new FaqService(this.jurisdictionId)
    const kept = await faqService.replaceEntries(upserts)
    log.info(`faq cache stored=${kept.length} extracted=${questions.length}`)
    return { extracted: questions.length, stored: kept.length }
  }

  async refreshAnswers(): Promise<FaqRefreshResult> {
    const log = createLogger("faq-refresh", this.logSource)
    const faqService = new FaqService(this.jurisdictionId)
    const existing = await faqService.listExistingQuestions()
    if (existing.length === 0) {
      log.info("faq refresh found no existing questions")
      return { total: 0, updated: 0, withSources: 0 }
    }

    const generated = await mapPool(
      existing,
      FAQ_GENERATE_CONCURRENCY,
      async (entry) => {
        const generatedAnswer = await this.generateAnswer(entry.question, log)
        if (!generatedAnswer) return null
        await faqService.updateGeneratedAnswer(entry.id, generatedAnswer)
        return generatedAnswer
      },
    )

    const updated = generated.filter(
      (row): row is NonNullable<typeof row> => row != null,
    )
    const withSources = updated.filter((row) => row.sources != null).length
    log.info(
      `faq refresh updated=${updated.length} withSources=${withSources} total=${existing.length}`,
    )
    return {
      total: existing.length,
      updated: updated.length,
      withSources,
    }
  }

  private async generateAnswer(
    question: string,
    log: { warn: (message: string) => void },
  ): Promise<{
    answer: string
    sources: ChatSource[] | null
    model: string | null
  } | null> {
    try {
      const chatService = new ChatService(
        this.jurisdictionId,
        buildChatPrompt(this.prompt, { date: new Date() }),
        this.logSource,
      )
      const result = await chatService.chat(question)
      if (!result.response.trim()) return null
      return {
        answer: result.response,
        sources: usableFaqSources(result.sources),
        model: result.model ?? null,
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      log.warn(
        `faq generate failed question=${JSON.stringify(question.slice(0, 80))} ${err.message}`,
      )
      return null
    }
  }

  private async fetchFaqPage(): Promise<string> {
    const res = await fetch(this.faqUrl, {
      signal: AbortSignal.timeout(FAQ_FETCH_TIMEOUT_MS),
      headers: { Accept: "text/html,application/xhtml+xml" },
    })
    if (!res.ok) {
      throw new Error(
        `FAQ page fetch failed (${res.status}) for ${this.faqUrl}`,
      )
    }
    const contentType = res.headers.get("content-type") ?? ""
    if (contentType && !/html|xml|text\/plain/i.test(contentType)) {
      throw new Error(`FAQ page is not HTML (${contentType})`)
    }
    return res.text()
  }

  private visiblePageText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private createLlm(): ChatOpenAI {
    const model = config.llm.model
    if (!model) {
      throw new Error(
        "Model not found. Please set LLM_MODEL in your environment variables.",
      )
    }

    const openaiOpts: ChatOpenAIFields = {
      model,
      maxCompletionTokens: LLM_MAX_TOKENS,
      useResponsesApi: true,
      // Hardcode high reasoning for FAQ
      reasoning: {
        effort: "high",
      },
    }

    return new ChatOpenAI(openaiOpts)
  }

  private parseQuestions(parsed: unknown): string[] {
    if (!parsed || typeof parsed !== "object" || !("questions" in parsed)) {
      return []
    }
    const questions = (parsed as { questions: unknown }).questions
    if (!Array.isArray(questions)) return []

    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of questions) {
      if (typeof raw !== "string") continue
      const question = raw.replace(/\s+/g, " ").trim()
      if (!question) continue
      const key = normalizeFaqQuestion(question)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(question)
      if (out.length >= MAX_FAQS_PER_JURISDICTION) break
    }
    return out
  }

  private async extractQuestions(pageText: string): Promise<string[]> {
    const llm = this.createLlm()
    const response = await llm.invoke([
      new SystemMessage(
        `You read a US city/county government FAQ page.
Extract the most useful resident-facing questions and return only the top ${MAX_FAQS_PER_JURISDICTION}, ranked best-first.
Return JSON only: { "questions": string[] }.
Prefer taxes, permits, licenses, hours, contacts, fees, trash/recycling, voting, property, zoning, and how-to-apply.
Skip navigation, HR, meeting agendas, and near-duplicates.`,
      ),
      new HumanMessage(pageText.slice(0, LLM_PAGE_TEXT_CHARS)),
    ])

    const text = messageContentToString(response.content)
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start < 0 || end <= start) return []
    try {
      return this.parseQuestions(JSON.parse(text.slice(start, end + 1)))
    } catch {
      return []
    }
  }
}
