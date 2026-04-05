import { Request, Response } from "express"
import { ChatService } from "../../services/agent/chat.service"
import { renderSystemPrompt } from "../../lib/system-prompt"
import { prisma } from "../../lib/prisma"
import { encrypt } from "../../lib/encryption"

const MAX_MESSAGE_LENGTH = 4000

export const chat = async (req: Request, res: Response) => {
  try {
    const {
      message,
      source,
      history: rawHistory,
      conversationId: existingConversationId,
    } = req.body

    const jurisdiction = req.jurisdiction
    if (!jurisdiction || jurisdiction.source !== source) {
      return res.status(403).json({
        error: "Access denied",
        message: "You are not authorized to access this resource",
      })
    }

    // Validate message
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
      return res.status(400).json({
        error: "Access denied",
        message: "You are not authorized to access this resource",
      })
    }

    const systemPrompt = renderSystemPrompt(jurisdiction.prompt, {
      date: new Date(),
    })
    const chatService = new ChatService(source, systemPrompt)
    const startTime = Date.now()
    const { response, model, inputTokens, outputTokens } =
      await chatService.chat(message, rawHistory)
    const responseTime = Date.now() - startTime

    // Persist both user and agent messages (encrypted if MESSAGE_ENCRYPTION_KEY is set)
    let conversationId =
      typeof existingConversationId === "string"
        ? existingConversationId.trim()
        : null
    if (conversationId) {
      const existing = await prisma.conversation.findFirst({
        where: { id: conversationId, source },
      })
      if (!existing) conversationId = null
    }
    if (!conversationId) {
      const created = await prisma.conversation.create({
        data: { source },
      })
      conversationId = created.id
    }

    const userContentToStore = encrypt(message)
    const agentContentToStore = encrypt(response)

    await prisma.message.create({
      data: { conversationId, role: "user", content: userContentToStore },
    })
    const agentMsg = await prisma.message.create({
      data: {
        conversationId,
        role: "agent",
        content: agentContentToStore,
        model: model ?? undefined,
        inputTokens: inputTokens ?? undefined,
        outputTokens: outputTokens ?? undefined,
        responseTime,
      },
    })

    res.status(200).json({
      response,
      conversationId,
      agentMessageId: agentMsg.id,
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("Error in chat function:", err)
    res.status(500).json({
      error: "Failed to process chat request",
      message: "An error occurred. Please try again.",
    })
  }
}
