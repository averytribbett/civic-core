import { Request, Response } from "express"
import { prisma } from "../../lib/prisma"
import { createLogger } from "../../lib/logger"

/**
 * Lists jurisdictions for local widget demo switching.
 * Mounted only when ENABLE_DEV_ROUTES=true (see routes/index.ts).
 */
export const listJurisdictions = async (_req: Request, res: Response) => {
  const log = createLogger("dev")

  try {
    const jurisdictions = await prisma.jurisdiction.findMany({
      select: {
        source: true,
        name: true,
        type: true,
        enabled: true,
        crawlUrl: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    })

    return res.status(200).json({ jurisdictions })
  } catch (error: unknown) {
    const err = error as Error
    log.error(`list jurisdictions failed: ${err.message}`)
    return res.status(500).json({
      error: "Failed to list jurisdictions",
      message: err.message,
    })
  }
}
