import { BaseMessage } from "@langchain/core/messages"

// LLM Provider types
export type LLMProvider = "openai" | "anthropic" | "google"

// State for the LangGraph workflow
export interface ChatState {
  messages: BaseMessage[]
}
