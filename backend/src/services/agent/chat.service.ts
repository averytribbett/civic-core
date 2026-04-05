import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { StateGraph, END, START } from "@langchain/langgraph"
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages"
import { StructuredToolInterface } from "@langchain/core/tools"
import { LLMProvider, ChatState } from "../../lib/types/chat.types"
import { createSearchWebsiteDocumentsTool } from "./tools/search-website-documents"

const MAX_HISTORY_LENGTH = 20
const MAX_HISTORY_ITEM_LENGTH = 2000

export class ChatService {
  private llm: Pick<BaseChatModel, "invoke">
  private provider: LLMProvider
  private model?: string
  private readonly source: string
  private readonly systemPrompt: string
  private searchTool: StructuredToolInterface

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

  constructor(source: string, systemPrompt: string) {
    this.source = source
    this.systemPrompt = systemPrompt
    this.provider = (process.env.LLM_PROVIDER as LLMProvider) || "openai"
    this.model = process.env.LLM_MODEL
    this.searchTool = createSearchWebsiteDocumentsTool(source)
    this.llm = this.createLLM()
  }

  private createLLM(): Pick<BaseChatModel, "invoke"> {
    const model = this.model
    const temperature = parseFloat(process.env.LLM_TEMPERATURE || "0.7")
    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || "1000")

    if (!model) {
      throw new Error(
        "Model not found. Please set LLM_MODEL in your environment variables.",
      )
    }

    let llm: BaseChatModel
    switch (this.provider) {
      case "openai":
        llm = new ChatOpenAI({
          modelName: model,
          temperature,
          maxTokens,
        })
        break

      case "anthropic":
        llm = new ChatAnthropic({
          modelName: model,
          temperature,
          maxTokens,
        })
        break

      case "google":
        llm = new ChatGoogleGenerativeAI({
          model,
          temperature,
          maxOutputTokens: maxTokens,
        })
        break

      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`)
    }

    const tools = [this.searchTool]
    // `bindTools` is optional on `BaseChatModel` types, and returns a *new* runnable.
    // Guard the call and keep the returned runnable so tool-calls actually work.
    if (typeof (llm as any).bindTools === "function") {
      return (llm as any).bindTools(tools)
    }
    return llm
  }

  /**
   * Create a LangGraph workflow with tool support.
   * @param systemPrompt - System prompt with current date (passed from chat() for correct "today").
   */
  private createChatGraph(systemPrompt: string) {
    // Define the chat node - LLM decides whether to use tools
    const chatNode = async (state: ChatState) => {
      let messages = [...state.messages]

      // Add system message at the beginning if not already present
      const hasSystemMessage = messages.some(
        (msg) => msg instanceof SystemMessage,
      )
      if (!hasSystemMessage && systemPrompt) {
        messages = [new SystemMessage(systemPrompt), ...messages]
      }

      const response = await this.llm.invoke(messages)
      return {
        messages: [...state.messages, response],
      }
    }

    // Define the tool node - executes tools when LLM requests them
    const toolNode = async (state: ChatState) => {
      const lastMessage = state.messages[state.messages.length - 1]

      if (!(lastMessage instanceof AIMessage)) {
        return { messages: [] }
      }

      // Get tool calls from the AI message
      const toolCalls = lastMessage.tool_calls || []

      if (toolCalls.length === 0) {
        return { messages: [] }
      }

      const toolNames = toolCalls.map((c) => c.name || "unknown").join(", ")
      console.log(
        `[tools] Executing ${toolCalls.length} tool call(s): ${toolNames}`,
      )

      // Execute each tool call
      const toolMessages = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.name || ""
          const toolInput = (toolCall.args || {}) as Record<string, any>
          const toolCallId = toolCall.id || ""

          try {
            const tools = [this.searchTool]
            const tool = tools.find((t) => t.name === toolName)

            if (!tool) {
              console.warn(`[tools] Unknown tool requested: ${toolName}`)
              return new ToolMessage({
                content: `Tool ${toolName} not found`,
                tool_call_id: toolCallId,
              })
            }

            // Execute the tool with proper input validation
            const validatedInput: { query: string; limit: number } = {
              query: typeof toolInput.query === "string" ? toolInput.query : "",
              limit: typeof toolInput.limit === "number" ? toolInput.limit : 5,
            }
            if (toolName === "search_website_documents") {
              console.log(
                `[tools] Invoking ${toolName} query="${validatedInput.query}"`,
              )
            } else {
              console.log(`[tools] Invoking ${toolName}`, validatedInput)
            }
            const result = await tool.invoke(validatedInput)
            console.log(`[tools] ${toolName} completed`)

            return new ToolMessage({
              content:
                typeof result === "string" ? result : JSON.stringify(result),
              tool_call_id: toolCallId,
            })
          } catch (error: any) {
            console.error(`[tools] Error executing ${toolName}:`, error)
            return new ToolMessage({
              content: `Error executing tool: ${error.message || "Unknown error"}`,
              tool_call_id: toolCallId,
            })
          }
        }),
      )

      return {
        messages: toolMessages,
      }
    }

    // Define conditional edge - check if we need to call tools
    const shouldContinue = (state: ChatState) => {
      const lastMessage = state.messages[state.messages.length - 1]

      // If the last message has tool calls, we need to execute tools
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.tool_calls &&
        lastMessage.tool_calls.length > 0
      ) {
        return "tools"
      }

      // Otherwise, we're done
      return END
    }

    // Build the graph
    const workflow = new StateGraph<ChatState>({
      channels: {
        messages: {
          reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
      },
    })
      .addNode("chat", chatNode)
      .addNode("tools", toolNode)
      .addEdge(START, "chat")
      .addConditionalEdges("chat", shouldContinue)
      .addEdge("tools", "chat") // After tools, go back to chat

    return workflow.compile()
  }

  /**
   * Send a message and get a response with tool-based RAG support.
   * Returns response text plus model and token usage for persistence.
   */
  async chat(
    message: string,
    rawHistory?: unknown,
  ): Promise<{
    response: string
    model: string | undefined
    inputTokens: number | undefined
    outputTokens: number | undefined
  }> {
    try {
      // Build message history from raw request payload
      const messages: BaseMessage[] = this.parseHistory(rawHistory)
      messages.push(new HumanMessage(message))

      // Create and run the graph (recursion limit to prevent runaway tool loops)
      const graph = this.createChatGraph(this.systemPrompt)
      const result = await graph.invoke(
        { messages },
        { recursionLimit: 10 },
      )

      // Extract the last AI message (should be the final response)
      const resultMessages = (result as any).messages as BaseMessage[]

      // Find the last AIMessage that doesn't have tool calls (final response)
      let lastMessage: AIMessage | null = null
      for (let i = resultMessages.length - 1; i >= 0; i--) {
        const msg = resultMessages[i]
        if (msg instanceof AIMessage) {
          // If this message has no tool calls, it's the final response
          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            lastMessage = msg
            break
          }
        }
      }

      // If we didn't find a final response, use the last AI message
      if (!lastMessage) {
        const lastAIMessage = resultMessages
          .filter((msg) => msg instanceof AIMessage)
          .pop() as AIMessage | undefined
        if (lastAIMessage) {
          lastMessage = lastAIMessage
        }
      }

      if (!lastMessage) {
        throw new Error("No AI response generated")
      }

      // Aggregate token usage from all AI messages in this turn (multiple if tools were used)
      let inputTokens = 0
      let outputTokens = 0
      for (const msg of resultMessages) {
        if (msg instanceof AIMessage && msg.usage_metadata) {
          const u = msg.usage_metadata as {
            input_tokens?: number
            output_tokens?: number
          }
          inputTokens += u.input_tokens ?? 0
          outputTokens += u.output_tokens ?? 0
        }
      }

      return {
        response: lastMessage.content as string,
        model: this.model,
        inputTokens: inputTokens > 0 ? inputTokens : undefined,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
      }
    } catch (error: any) {
      console.error("Error in chat service:", error)
      throw new Error(`Chat service error: ${error.message}`)
    }
  }
}
