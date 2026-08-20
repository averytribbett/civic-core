import { prisma } from "../../lib/prisma"
import { createLogger } from "../../lib/logger"

const log = createLogger("voice-call")

export async function createVoiceCallRecord(opts: {
  jurisdictionId: string
  externalCallId: string
  model?: string
}) {
  try {
    return await prisma.voiceCall.create({
      data: {
        jurisdictionId: opts.jurisdictionId,
        externalCallId: opts.externalCallId,
        model: opts.model,
      },
    })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code === "P2002") {
      return prisma.voiceCall.findUnique({
        where: { externalCallId: opts.externalCallId },
      })
    }
    throw error
  }
}

export async function incrementVoiceCallTurns(
  externalCallId: string,
  delta: { turns?: number; toolCalls?: number } = {},
) {
  const existing = await prisma.voiceCall.findUnique({
    where: { externalCallId },
  })
  if (!existing) return

  await prisma.voiceCall.update({
    where: { externalCallId },
    data: {
      turnCount: existing.turnCount + (delta.turns ?? 0),
      toolCallCount: existing.toolCallCount + (delta.toolCalls ?? 0),
    },
  })
}

export async function appendVoiceCallTranscript(
  externalCallId: string,
  line: string,
) {
  const existing = await prisma.voiceCall.findUnique({
    where: { externalCallId },
  })
  if (!existing) return

  const prefix = existing.transcript ? `${existing.transcript}\n` : ""
  await prisma.voiceCall.update({
    where: { externalCallId },
    data: { transcript: `${prefix}${line}` },
  })
}

export async function finalizeVoiceCall(
  externalCallId: string,
  opts?: { durationSec?: number },
) {
  const existing = await prisma.voiceCall.findUnique({
    where: { externalCallId },
  })
  if (!existing || existing.endedAt) return

  const endedAt = new Date()
  const durationSec =
    opts?.durationSec ??
    Math.max(
      0,
      Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000),
    )

  await prisma.voiceCall.update({
    where: { externalCallId },
    data: { endedAt, durationSec },
  })
  log.info(
    `Call ${externalCallId} ended durationSec=${durationSec} turns=${existing.turnCount} tools=${existing.toolCallCount}`,
  )
}

export async function findJurisdictionByInboundPhone(e164: string) {
  return prisma.jurisdiction.findUnique({
    where: { inboundPhoneNumber: e164 },
  })
}
