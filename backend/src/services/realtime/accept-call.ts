import OpenAI from "openai"
import { createLogger } from "../../lib/logger"
import { config } from "../../config"
import { buildVoicePrompt } from "../../config/prompts"
import { SEARCH_WEBSITE_DOCUMENTS_TOOL } from "./search-tool-definition"

const log = createLogger("realtime-accept")

function openAiClient(): OpenAI {
  const apiKey = config.openai.apiKey
  if (!apiKey) throw new Error("OPENAI_API_KEY is required")
  return new OpenAI({ apiKey })
}

export type AcceptCallContext = {
  callId: string
  jurisdictionId: string
  jurisdictionSource: string
  promptTemplate: string
}

export async function acceptRealtimeCall(ctx: AcceptCallContext): Promise<void> {
  const client = openAiClient()
  const model = config.voice.realtimeModel
  const instructions = buildVoicePrompt(ctx.promptTemplate)

  const body = {
    type: "realtime",
    model,
    instructions,
    audio: {
      output: {
        voice: config.voice.realtimeVoice,
      },
      input: {
        turn_detection: {
          type: "semantic_vad",
          interrupt_response: true,
        },
      },
    },
    tools: [SEARCH_WEBSITE_DOCUMENTS_TOOL],
    tool_choice: "auto" as const,
  }

  try {
    await client.post(`/realtime/calls/${ctx.callId}/accept`, { body })
    log.info(
      `Accepted call ${ctx.callId} model=${model} source=${ctx.jurisdictionSource}`,
    )
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string }
    if (err.status === 404) {
      log.warn(
        `Call ${ctx.callId} not found on accept (404); caller may have hung up`,
      )
      return
    }
    throw error
  }
}

export async function rejectRealtimeCall(callId: string): Promise<void> {
  const client = openAiClient()
  try {
    await client.post(`/realtime/calls/${callId}/reject`, { body: {} })
    log.info(`Rejected call ${callId}`)
  } catch (error: unknown) {
    const err = error as { status?: number }
    if (err.status === 404) return
    throw error
  }
}
