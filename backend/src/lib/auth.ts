import { Request, Response, NextFunction } from "express"
import { prisma } from "./prisma"
import { validateWidgetOrigin } from "./widget-origin"

/**
 * Validates `Origin` / `Referer` against `WIDGET_ALLOWED_ORIGINS`, then loads
 * `Jurisdiction` by `req.body.source` and attaches `req.jurisdiction`.
 */
export async function requireOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const source = req.body?.source
    if (!source || typeof source !== "string") {
      res.status(400).json({
        error: "Invalid request",
        message: "Source is required",
      })
      return
    }

    const originCheck = validateWidgetOrigin(req)
    if (!originCheck.ok) {
      res.status(originCheck.status).json({
        error: originCheck.error,
        message: originCheck.message,
      })
      return
    }

    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { source },
    })

    if (!jurisdiction) {
      res.status(403).json({
        error: "Forbidden",
        message: "Unknown or inactive source",
      })
      return
    }

    req.jurisdiction = jurisdiction
    next()
  } catch (err) {
    next(err)
  }
}
