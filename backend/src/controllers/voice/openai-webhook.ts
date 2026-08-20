import type { Request, Response } from "express"
import OpenAI from "openai"
import { createLogger } from "../../lib/logger"
import { calledNumberFromSipHeaders, formatSipHeadersForLog } from "../../lib/phone-number"
import { config } from "../../config"
import {
  acceptRealtimeCall,
  rejectRealtimeCall,
} from "../../services/realtime/accept-call"
import { attachRealtimeSideband } from "../../services/realtime/sideband-session"
import {
  createVoiceCallRecord,
  findJurisdictionByInboundPhone,
  finalizeVoiceCall,
} from "../../services/voice/voice-call.service"

// TODO: I don think I like this and openAIclient being at the controller level
const log = createLogger("openai-webhook")

function openAiClient(): OpenAI | null {
  const apiKey = config.openai.apiKey
  const secret = config.openai.webhookSecret
  if (!apiKey || !secret) return null
  return new OpenAI({ apiKey, webhookSecret: secret })
}

type IncomingCallEvent = {
  type?: string
  data?: {
    call_id?: string
    sip_headers?: Array<{ name?: string; value?: string }>
  }
}

export async function openAiVoiceWebhook(req: Request, res: Response) {
  if (!config.features.voiceEnabled) {
    return res.status(503).json({ error: "Voice is not enabled" })
  }

  const client = openAiClient()
  if (!client) {
    log.error("OPENAI_API_KEY or OPENAI_WEBHOOK_SECRET not configured")
    return res.status(503).json({ error: "Voice webhook not configured" })
  }

  const rawBody =
    (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("")
  let event: IncomingCallEvent

  try {
    event = (await client.webhooks.unwrap(
      rawBody.toString("utf8"),
      req.headers as Record<string, string>,
    )) as IncomingCallEvent
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error("Invalid OpenAI webhook signature:", err)
    return res.status(400).json({ error: "Invalid signature" })
  }

  const type = event.type
  const callId = event.data?.call_id

  if (type === "realtime.call.incoming" && callId) {
    const called = calledNumberFromSipHeaders(event.data?.sip_headers)
    if (!called) {
      log.warn(
        `Incoming call ${callId} with no routable To header; rejecting. sip_headers: ${formatSipHeadersForLog(event.data?.sip_headers)}`,
      )
      await rejectRealtimeCall(callId)
      return res.sendStatus(200)
    }

    const jurisdiction = await findJurisdictionByInboundPhone(called)
    if (!jurisdiction) {
      log.warn(
        `No jurisdiction for inbound ${called}; rejecting call ${callId}. sip_headers: ${formatSipHeadersForLog(event.data?.sip_headers)}`,
      )
      await rejectRealtimeCall(callId)
      return res.sendStatus(200)
    }

    await createVoiceCallRecord({
      jurisdictionId: jurisdiction.id,
      externalCallId: callId,
      model: config.voice.realtimeModel,
    })

    await acceptRealtimeCall({
      callId,
      jurisdictionId: jurisdiction.id,
      jurisdictionSource: jurisdiction.source,
      promptTemplate: jurisdiction.prompt,
    })

    attachRealtimeSideband({
      callId,
      jurisdictionId: jurisdiction.id,
      jurisdictionSource: jurisdiction.source,
    })

    return res.sendStatus(200)
  }

  if (
    (type === "realtime.call.ended" || type === "realtime.call.hangup") &&
    callId
  ) {
    await finalizeVoiceCall(callId)
    return res.sendStatus(200)
  }

  return res.sendStatus(200)
}
