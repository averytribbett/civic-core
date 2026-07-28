import { Request, Response } from "express"
import { ChatService } from "../../services/agent/chat.service"
import { renderSystemPrompt } from "../../lib/system-prompt"
import type { ChatSource } from "../../lib/types/chat-source.types"
import { prisma } from "../../lib/prisma"
import { encrypt } from "../../lib/encryption"
import { createLogger, safeLogText } from "../../lib/logger"

const MAX_MESSAGE_LENGTH = 4000

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

async function persistChatTurn(opts: {
  source: string
  existingConversationId: string | null
  message: string
  response: string
  sources: ChatSource[]
  language: string | undefined
  model: string | undefined
  inputTokens: number | undefined
  outputTokens: number | undefined
  responseTime: number
}): Promise<{ conversationId: string; agentMessageId: string }> {
  let conversationId = opts.existingConversationId
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, source: opts.source },
    })
    if (!existing) conversationId = null
  }
  if (!conversationId) {
    const created = await prisma.conversation.create({
      data: { source: opts.source },
    })
    conversationId = created.id
  }

  const userContentToStore = encrypt(opts.message)
  const agentContentToStore = encrypt(opts.response)

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: userContentToStore,
      language: opts.language,
    },
  })
  const agentMsg = await prisma.message.create({
    data: {
      conversationId,
      role: "agent",
      content: agentContentToStore,
      model: opts.model ?? undefined,
      inputTokens: opts.inputTokens ?? undefined,
      outputTokens: opts.outputTokens ?? undefined,
      responseTime: opts.responseTime,
      sources: opts.sources.length > 0 ? opts.sources : undefined,
    },
  })

  return { conversationId, agentMessageId: agentMsg.id }
}

export const chat = async (req: Request, res: Response) => {
  const bodySource =
    typeof req.body?.source === "string" ? req.body.source : undefined
  const log = createLogger("chat", bodySource)

  try {
    const {
      message,
      source,
      history: rawHistory,
      conversationId: existingConversationId,
      language: rawLanguage,
      stream: streamFlag,
    } = req.body

    const jurisdiction = req.jurisdiction
    if (!jurisdiction || jurisdiction.source !== source) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this resource",
      })
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Message is required and must be a string",
      })
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: "Invalid request",
        message: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`,
      })
    }

    if (!source || typeof source !== "string") {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this resource",
      })
    }

    const wantStream =
      streamFlag === true ||
      (typeof req.headers.accept === "string" &&
        req.headers.accept.includes("text/event-stream"))

    const chatLog = createLogger("chat", source)
    const messagePreview = safeLogText(message)
    chatLog.info(
      messagePreview
        ? `start stream=${wantStream} message=${JSON.stringify(messagePreview)}`
        : `start stream=${wantStream}`,
    )

    const systemPrompt = renderSystemPrompt(jurisdiction.prompt, {
      date: new Date(),
    })
    const chatService = new ChatService(source, systemPrompt)
    const language =
      typeof rawLanguage === "string" && rawLanguage.trim()
        ? rawLanguage.trim().slice(0, 16)
        : undefined
    const conversationIdRaw =
      typeof existingConversationId === "string"
        ? existingConversationId.trim()
        : null

    if (wantStream) {
      res.status(200)
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("Connection", "keep-alive")
      res.setHeader("X-Accel-Buffering", "no")
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders()
      }

      const startTime = Date.now()
      try {
        let complete: {
          response: string
          sources: ChatSource[]
          model: string | undefined
          inputTokens: number | undefined
          outputTokens: number | undefined
        } | null = null

        for await (const event of chatService.chatStream(message, rawHistory)) {
          if (event.type === "token") {
            writeSse(res, "token", { text: event.text })
          } else if (event.type === "complete") {
            complete = event
          }
        }

        if (!complete) {
          chatLog.error("error stream ended without complete event")
          writeSse(res, "error", {
            message: "An error occurred. Please try again.",
          })
          return res.end()
        }

        const responseTime = Date.now() - startTime
        const persisted = await persistChatTurn({
          source,
          existingConversationId: conversationIdRaw,
          message,
          response: complete.response,
          sources: complete.sources,
          language,
          model: complete.model,
          inputTokens: complete.inputTokens,
          outputTokens: complete.outputTokens,
          responseTime,
        })

        chatLog.info(
          `done stream=true ms=${responseTime} in=${complete.inputTokens ?? 0} out=${complete.outputTokens ?? 0} conversationId=${persisted.conversationId}`,
        )

        writeSse(res, "done", {
          response: complete.response,
          sources: complete.sources,
          conversationId: persisted.conversationId,
          agentMessageId: persisted.agentMessageId,
        })
        return res.end()
      } catch (streamErr: unknown) {
        const err =
          streamErr instanceof Error ? streamErr : new Error(String(streamErr))
        chatLog.error(`error ${err.message}`)
        if (!res.writableEnded) {
          writeSse(res, "error", {
            message: "An error occurred. Please try again.",
          })
          res.end()
        }
        return
      }
    }

    const startTime = Date.now()
    const { response, sources, model, inputTokens, outputTokens } =
      await chatService.chat(message, rawHistory)
    const responseTime = Date.now() - startTime

    const persisted = await persistChatTurn({
      source,
      existingConversationId: conversationIdRaw,
      message,
      response,
      sources,
      language,
      model,
      inputTokens,
      outputTokens,
      responseTime,
    })

    chatLog.info(
      `done stream=false ms=${responseTime} in=${inputTokens ?? 0} out=${outputTokens ?? 0} conversationId=${persisted.conversationId}`,
    )

    res.status(200).json({
      response,
      sources,
      conversationId: persisted.conversationId,
      agentMessageId: persisted.agentMessageId,
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error(`error ${err.message}`)
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to process chat request",
        message: "An error occurred. Please try again.",
      })
    }
  }
}
