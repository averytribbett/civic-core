import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages"
import { StructuredToolInterface } from "@langchain/core/tools"
import type { ChatSource } from "../../lib/types/chat-source.types"
import { createLogger, isProductionLogging, safeLogText } from "../../lib/logger"
import { createSearchWebsiteDocumentsTool } from "./tools/search-website-documents"
import { SourcesCollector } from "./sources-collector"

const MAX_HISTORY_LENGTH = 20
const MAX_HISTORY_ITEM_LENGTH = 2000
/** Max tool rounds (LLM decide → tools → LLM) before forcing an answer. */
const MAX_TOOL_ROUNDS = 5

type BoundLLM = Pick<BaseChatModel, "invoke"> & {
  stream?: (
    messages: BaseMessage[],
  ) => AsyncIterable<AIMessageChunk> | Promise<AsyncIterable<AIMessageChunk>>
}

type ChatResult = {
  response: string
  sources: ChatSource[]
  model: string | undefined
  inputTokens: number | undefined
  outputTokens: number | undefined
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

export class ChatService {
  private llm: BoundLLM
  private model?: string
  private readonly logSource: string
  private readonly systemPrompt: string
  private searchTool: StructuredToolInterface
  private sourcesCollector: SourcesCollector

  private parseHistory(raw: unknown): BaseMessage[] {
    if (raw === undefined || raw === null) return []
    if (!Array.isArray(raw)) return []
    const out: BaseMessage[] = []
    for (const item of (raw as unknown[]).slice(0, MAX_HISTORY_LENGTH)) {
      if (
        item &&
        typeof item === "object" &&
        "role" in item &&
        "content" in item
      ) {
        const role = (item as { role: string }).role
        const content = (item as { content: unknown }).content
        if (
          (role === "user" || role === "agent") &&
          typeof content === "string"
        ) {
          const truncated =
            content.length > MAX_HISTORY_ITEM_LENGTH
              ? content.slice(0, MAX_HISTORY_ITEM_LENGTH)
              : content
          out.push(
            role === "user"
              ? new HumanMessage(truncated)
              : new AIMessage(truncated),
          )
        }
      }
    }
    return out
  }

  constructor(jurisdictionId: string, systemPrompt: string, logSource?: string) {
    this.logSource = logSource ?? jurisdictionId
    this.systemPrompt = systemPrompt
    this.model = process.env.LLM_MODEL
    this.sourcesCollector = new SourcesCollector()
    this.searchTool = createSearchWebsiteDocumentsTool(jurisdictionId, {
      getCollector: () => this.sourcesCollector,
      logSource: this.logSource,
    })
    this.llm = this.createLLM()
  }

  private resetSourcesCollector() {
    this.sourcesCollector = new SourcesCollector()
  }

  private createLLM(): BoundLLM {
    const model = this.model
    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || "1000", 10)
    const reasoningEffort = (
      process.env.LLM_REASONING_EFFORT || "none"
    ).toLowerCase()

    if (!model) {
      throw new Error(
        "Model not found. Please set LLM_MODEL in your environment variables.",
      )
    }

    const openaiOpts: ChatOpenAIFields = {
      model,
      maxCompletionTokens: maxTokens,
      useResponsesApi: true,
    }
    if (
      reasoningEffort &&
      reasoningEffort !== "default" &&
      ["none", "minimal", "low", "medium", "high", "xhigh"].includes(
        reasoningEffort,
      )
    ) {
      openaiOpts.reasoning = {
        effort: reasoningEffort as NonNullable<
          ChatOpenAIFields["reasoning"]
        >["effort"],
      }
    }
    const llm: BaseChatModel = new ChatOpenAI(openaiOpts)

    const tools = [this.searchTool]
    if (
      "bindTools" in llm &&
      typeof (llm as BaseChatModel & { bindTools?: unknown }).bindTools ===
        "function"
    ) {
      return (
        llm as BaseChatModel & {
          bindTools: (tools: StructuredToolInterface[]) => BoundLLM
        }
      ).bindTools(tools)
    }
    return llm as BoundLLM
  }

  private buildMessages(
    message: string,
    rawHistory?: unknown,
  ): BaseMessage[] {
    const history = this.parseHistory(rawHistory)
    const messages: BaseMessage[] = []
    if (this.systemPrompt) {
      messages.push(new SystemMessage(this.systemPrompt))
    }
    messages.push(...history)
    messages.push(new HumanMessage(message))
    return messages
  }

  private async executeToolCalls(
    aiMessage: AIMessage,
  ): Promise<ToolMessage[]> {
    const toolCalls = aiMessage.tool_calls || []
    if (toolCalls.length === 0) return []

    const log = createLogger("tools", this.logSource)
    const toolNames = toolCalls.map((c) => c.name || "unknown").join(", ")
    log.info(`Executing ${toolCalls.length} tool call(s): ${toolNames}`)

    return Promise.all(
      toolCalls.map(async (toolCall) => {
        const toolName = toolCall.name || ""
        const toolInput = (toolCall.args || {}) as Record<string, unknown>
        const toolCallId = toolCall.id || ""

        try {
          const tool = [this.searchTool].find((t) => t.name === toolName)
          if (!tool) {
            log.warn(`Unknown tool requested: ${toolName}`)
            return new ToolMessage({
              content: `Tool ${toolName} not found`,
              tool_call_id: toolCallId,
            })
          }

          const validatedInput = {
            query: typeof toolInput.query === "string" ? toolInput.query : "",
          }
          const queryPreview = safeLogText(validatedInput.query, 200)
          const queryLog = isProductionLogging()
            ? "query=(redacted)"
            : queryPreview
              ? `query=${JSON.stringify(queryPreview)}`
              : "query=(empty)"
          log.info(`Invoking ${toolName} ${queryLog}`)
          const result = await tool.invoke(validatedInput)
          log.info(`${toolName} completed`)

          return new ToolMessage({
            content:
              typeof result === "string" ? result : JSON.stringify(result),
            tool_call_id: toolCallId,
          })
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error))
          log.error(`Error executing ${toolName}:`, err)
          return new ToolMessage({
            content: `Error executing tool: ${err.message || "Unknown error"}`,
            tool_call_id: toolCallId,
          })
        }
      }),
    )
  }

  private usageFromMessage(msg: AIMessage | AIMessageChunk): {
    inputTokens: number
    outputTokens: number
  } {
    const u = msg.usage_metadata as
      | { input_tokens?: number; output_tokens?: number }
      | undefined
    return {
      inputTokens: u?.input_tokens ?? 0,
      outputTokens: u?.output_tokens ?? 0,
    }
  }

  /**
   * Non-streaming chat: LLM decides whether to call search_website_documents.
   */
  async chat(
    message: string,
    rawHistory?: unknown,
  ): Promise<ChatResult> {
    try {
      this.resetSourcesCollector()
      const messages = this.buildMessages(message, rawHistory)
      let inputTokens = 0
      let outputTokens = 0
      let response: AIMessage | null = null

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        response = (await this.llm.invoke(messages)) as AIMessage
        const u = this.usageFromMessage(response)
        inputTokens += u.inputTokens
        outputTokens += u.outputTokens

        if (!response.tool_calls || response.tool_calls.length === 0) {
          break
        }

        const toolMessages = await this.executeToolCalls(response)
        messages.push(response, ...toolMessages)
      }

      if (!response) {
        throw new Error("No AI response generated")
      }

      const text = messageContentToString(response.content)
      if (!text) {
        throw new Error("No AI response generated")
      }

      return {
        response: text,
        sources: this.sourcesCollector.buildCitedSources(text),
        model: this.model,
        inputTokens: inputTokens > 0 ? inputTokens : undefined,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      createLogger("chat", this.logSource).error("Error in chat service:", err)
      throw new Error(`Chat service error: ${err.message}`)
    }
  }

  private async *streamOneTurn(
    messages: BaseMessage[],
    streamFn: (
      messages: BaseMessage[],
    ) => AsyncIterable<AIMessageChunk> | Promise<AsyncIterable<AIMessageChunk>>,
  ): AsyncGenerator<
    | { type: "token"; text: string }
    | {
        type: "turn"
        assembled: string
        aiMessage: AIMessage
        inputTokens: number
        outputTokens: number
      }
  > {
    let assembled = ""
    let gathered: AIMessageChunk | null = null
    let inputTokens = 0
    let outputTokens = 0
    let sawToolCall = false

    for await (const chunk of await streamFn(messages)) {
      gathered = gathered ? gathered.concat(chunk) : chunk
      if (chunk.tool_call_chunks?.length || chunk.tool_calls?.length) {
        sawToolCall = true
      }
      const text = messageContentToString(chunk.content)
      if (text) {
        assembled += text
        if (!sawToolCall) {
          yield { type: "token", text }
        }
      }
      const u = this.usageFromMessage(chunk)
      inputTokens += u.inputTokens
      outputTokens += u.outputTokens
    }

    const toolCalls = gathered?.tool_calls
    const isToolTurn = !!(toolCalls && toolCalls.length > 0)

    const aiMessage = new AIMessage({
      content: gathered?.content ?? assembled,
      tool_calls: toolCalls,
      usage_metadata: gathered?.usage_metadata,
    })

    yield {
      type: "turn",
      assembled: isToolTurn ? "" : assembled,
      aiMessage,
      inputTokens,
      outputTokens,
    }
  }

  /**
   * Streaming chat: tool rounds run without tokens; final answer turn is streamed.
   */
  async *chatStream(
    message: string,
    rawHistory?: unknown,
  ): AsyncGenerator<
    | { type: "token"; text: string }
    | {
        type: "complete"
        response: string
        sources: ChatSource[]
        model: string | undefined
        inputTokens: number | undefined
        outputTokens: number | undefined
      }
  > {
    this.resetSourcesCollector()
    const messages = this.buildMessages(message, rawHistory)
    let inputTokens = 0
    let outputTokens = 0

    const streamFn = this.llm.stream?.bind(this.llm)
    if (!streamFn) {
      const result = await this.chat(message, rawHistory)
      if (result.response) {
        yield { type: "token", text: result.response }
      }
      yield {
        type: "complete",
        response: result.response,
        sources: result.sources,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
      return
    }

    let assembled = ""

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let toolCallAi: AIMessage | null = null
      assembled = ""

      for await (const event of this.streamOneTurn(messages, streamFn)) {
        if (event.type === "token") {
          yield event
        } else {
          inputTokens += event.inputTokens
          outputTokens += event.outputTokens
          if (
            event.aiMessage.tool_calls &&
            event.aiMessage.tool_calls.length > 0
          ) {
            toolCallAi = event.aiMessage
          } else {
            assembled = event.assembled
          }
        }
      }

      if (!toolCallAi) {
        break
      }

      const toolMessages = await this.executeToolCalls(toolCallAi)
      messages.push(toolCallAi, ...toolMessages)
    }

    if (!assembled) {
      throw new Error("No AI response generated")
    }

    yield {
      type: "complete",
      response: assembled,
      sources: this.sourcesCollector.buildCitedSources(assembled),
      model: this.model,
      inputTokens: inputTokens > 0 ? inputTokens : undefined,
      outputTokens: outputTokens > 0 ? outputTokens : undefined,
    }
  }
}
