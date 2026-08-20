import { BaseMessage } from "@langchain/core/messages"
import type { LlmProvider } from "../../config"

export type { LlmProvider as LLMProvider }

// State for the LangGraph workflow
export interface ChatState {
  messages: BaseMessage[]
}
