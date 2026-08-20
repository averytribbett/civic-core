import WebSocket from "ws"
import { createLogger } from "../../lib/logger"
import { config } from "../../config"
import { executeSearchWebsiteDocuments } from "./search-tool-handler"
import {
  appendVoiceCallTranscript,
  incrementVoiceCallTurns,
  finalizeVoiceCall,
} from "../voice/voice-call.service"

const log = createLogger("realtime-sideband")

type SidebandContext = {
  callId: string
  jurisdictionId: string
  jurisdictionSource: string
}

const activeSidebands = new Set<string>()

function openAiRealtimeWsUrl(callId: string): string {
  return `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

async function handleFunctionCall(
  ws: WebSocket,
  ctx: SidebandContext,
  item: {
    call_id?: string
    name?: string
    arguments?: string
  },
  toolRound: { count: number },
) {
  if (item.name !== "search_website_documents") return
  if (toolRound.count >= config.voice.maxToolRounds) {
    sendJson(ws, {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: item.call_id,
        output:
          "Tool limit reached for this call. Answer from general guidance or suggest the website.",
      },
    })
    sendJson(ws, { type: "response.create" })
    return
  }

  toolRound.count += 1
  let query = ""
  try {
    const parsed = JSON.parse(item.arguments || "{}") as { query?: string }
    query = typeof parsed.query === "string" ? parsed.query : ""
  } catch {
    query = ""
  }

  await incrementVoiceCallTurns(ctx.callId, { toolCalls: 1 })

  const output = await executeSearchWebsiteDocuments(
    query,
    ctx.jurisdictionId,
    ctx.jurisdictionSource,
  )

  sendJson(ws, {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: item.call_id,
      output,
    },
  })
  sendJson(ws, { type: "response.create" })
}

function extractFunctionCalls(response: {
  output?: Array<{
    type?: string
    name?: string
    call_id?: string
    arguments?: string
  }>
}): Array<{ call_id?: string; name?: string; arguments?: string }> {
  const out = response.output ?? []
  return out.filter((o) => o.type === "function_call")
}

export function attachRealtimeSideband(ctx: SidebandContext): void {
  if (activeSidebands.has(ctx.callId)) {
    log.info(`Sideband already active for ${ctx.callId}`)
    return
  }

  const apiKey = config.openai.apiKey
  if (!apiKey) {
    log.error("OPENAI_API_KEY missing; cannot attach sideband")
    return
  }

  activeSidebands.add(ctx.callId)

  const ws = new WebSocket(openAiRealtimeWsUrl(ctx.callId), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      origin: "https://api.openai.com",
    },
  })

  const toolRound = { count: 0 }

  ws.on("open", () => {
    log.info(`Sideband connected callId=${ctx.callId}`)
    sendJson(ws, {
      type: "response.create",
      response: {
        instructions:
          "Greet the caller briefly. Say you are the AI assistant for their city or county and ask how you can help.",
      },
    })
  })

  ws.on("message", (data) => {
    void (async () => {
      let event: {
        type?: string
        response?: {
          output?: Array<{
            type?: string
            name?: string
            call_id?: string
            arguments?: string
          }>
        }
        transcript?: string
      }
      try {
        event = JSON.parse(data.toString()) as typeof event
      } catch {
        return
      }

      if (event.type === "response.done" && event.response) {
        const calls = extractFunctionCalls(event.response)
        for (const fc of calls) {
          await handleFunctionCall(ws, ctx, fc, toolRound)
        }
      }

      if (
        event.type === "conversation.item.input_audio_transcription.completed" &&
        typeof event.transcript === "string" &&
        event.transcript.trim()
      ) {
        await incrementVoiceCallTurns(ctx.callId, { turns: 1 })
        await appendVoiceCallTranscript(
          ctx.callId,
          `Caller: ${event.transcript.trim()}`,
        )
      }

      if (
        event.type === "response.audio_transcript.done" &&
        typeof event.transcript === "string" &&
        event.transcript.trim()
      ) {
        await appendVoiceCallTranscript(
          ctx.callId,
          `Agent: ${event.transcript.trim()}`,
        )
      }
    })().catch((err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err))
      log.error(`Sideband message error callId=${ctx.callId}:`, e)
    })
  })

  ws.on("close", () => {
    activeSidebands.delete(ctx.callId)
    void finalizeVoiceCall(ctx.callId)
    log.info(`Sideband closed callId=${ctx.callId}`)
  })

  ws.on("error", (err) => {
    log.error(`Sideband WebSocket error callId=${ctx.callId}:`, err)
  })
}
