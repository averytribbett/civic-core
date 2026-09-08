import "dotenv/config"
import { prisma } from "../lib/prisma"
import { logger } from "../lib/logger"
import { FaqSyncService } from "../services/faq/faq-sync.service"

function resolveSourceFilter(argv: string[]): string | undefined {
  const fromArg = argv.find((a) => a.startsWith("--source="))
  if (fromArg) {
    const value = fromArg.slice("--source=".length).trim()
    if (value) return value
  }
  return undefined
}

async function main(): Promise<void> {
  const sourceFilter = resolveSourceFilter(process.argv.slice(2))

  const jurisdictions = await prisma.jurisdiction.findMany({
    where: sourceFilter
      ? { source: sourceFilter }
      : { faqEntries: { some: {} } },
    select: { id: true, source: true, prompt: true, faqUrl: true },
    orderBy: { source: "asc" },
  })

  if (jurisdictions.length === 0) {
    logger.json("info", {
      event: "faq_refresh_complete",
      status: "no_op",
      message: sourceFilter
        ? `No jurisdiction for source=${sourceFilter}`
        : "No jurisdictions with existing FAQ entries",
    })
    return
  }

  const toRun = sourceFilter ? jurisdictions.slice(0, 1) : jurisdictions

  logger.json("info", {
    event: "faq_refresh_start",
    count: toRun.length,
    sources: toRun.map((j) => j.source),
  })

  const failures: string[] = []

  for (const jurisdiction of toRun) {
    try {
      const result = await new FaqSyncService(
        jurisdiction.id,
        jurisdiction.faqUrl ?? "",
        jurisdiction.prompt,
        jurisdiction.source,
      ).refreshAnswers()
      logger.json("info", {
        event: "faq_refresh_jurisdiction",
        source: jurisdiction.source,
        status: "success",
        total: result.total,
        updated: result.updated,
        withSources: result.withSources,
      })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      failures.push(jurisdiction.source)
      logger.json("warn", {
        event: "faq_refresh_jurisdiction",
        source: jurisdiction.source,
        status: "error",
        error: err.message,
      })
    }
  }

  logger.json("info", {
    event: "faq_refresh_complete",
    status: failures.length === 0 ? "success" : "partial_failure",
    total: toRun.length,
    failed: failures,
  })

  if (failures.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.json("error", {
      event: "faq_refresh_fatal",
      status: "error",
      error: err.message,
      stack: err.stack,
    })
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } finally {
      process.exit()
    }
  })
