import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"
import { validateWidgetOrigin } from "../../lib/widget-origin"
import { createLogger } from "../../lib/logger"
import { FaqService } from "../../services/faq/faq.service"

export const getFaqs = async (req: Request, res: Response) => {
  const log = createLogger("widget-faqs")

  try {
    const originCheck = validateWidgetOrigin(req)
    if (!originCheck.ok) {
      return res.status(originCheck.status).json({
        error: originCheck.error,
        message: originCheck.message,
      })
    }

    const source = req.query.source
    if (!source || typeof source !== "string" || !source.trim()) {
      return res.status(400).json({
        error: "Invalid request",
        message: "source query parameter is required",
      })
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { source: source.trim() },
      select: { id: true },
    })

    if (!jurisdiction) {
      return res.status(404).json({
        error: "Not found",
        message: "Unknown source",
      })
    }

    const faqs = await new FaqService(jurisdiction.id).listQuestions()
    res.set("Cache-Control", "public, max-age=300")
    return res.status(200).json({ faqs })
  } catch (error: unknown) {
    const err = error as Error
    log.error(`get faqs failed: ${err.message}`)
    return res.status(500).json({
      error: "Failed to load FAQs",
      message: err.message,
    })
  }
}
