import { BaseMessage } from "@langchain/core/messages"

// Only OpenAI is enabled (ZDR agreement).
export type LLMProvider = "openai"

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase()
  if (provider !== "openai") {
    throw new Error(
      `LLM provider "${provider}" is not enabled. Only OpenAI is supported. Set LLM_PROVIDER=openai.`,
    )
  }
  return "openai"
}

// State for the LangGraph workflow
export interface ChatState {
  messages: BaseMessage[]
}
