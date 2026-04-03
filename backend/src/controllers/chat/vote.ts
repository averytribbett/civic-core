import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"
import { SourceType } from "../../lib/types/system-prompt.types"

const VALID_VOTES = ["up", "down"] as const

export const voteMessage = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.messageId
    const messageId =
      typeof rawId === "string"
        ? rawId.trim()
        : Array.isArray(rawId)
          ? rawId[0]?.trim()
          : ""
    const { vote, source } = req.body

    if (!messageId) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Message ID is required",
      })
    }

    if (
      !source ||
      typeof source !== "string" ||
      !Object.values(SourceType).includes(source as SourceType)
    ) {
      return res.status(400).json({
        error: "Access denied",
        message: "You are not authorized to access this resource",
      })
    }

    if (!vote || !VALID_VOTES.includes(vote)) {
      return res.status(400).json({
        error: "Invalid request",
        message: 'Vote must be "up" or "down"',
      })
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return res.status(404).json({
        error: "Not found",
        message: "Message not found",
      })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
    })
    if (!conversation || conversation.source !== source) {
      return res.status(403).json({
        error: "Access denied",
        message: "Message does not belong to this source",
      })
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { vote },
    })

    res.status(200).json({ ok: true, vote })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("Error in voteMessage:", err)
    res.status(500).json({
      error: "Failed to record vote",
      message: "An error occurred. Please try again.",
    })
  }
}
