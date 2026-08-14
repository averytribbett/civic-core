import "dotenv/config"
import { prisma } from "../lib/prisma"
import { runCrawlSync } from "../services/crawl-sync.service"
import { logger } from "../lib/logger"

type CrawlLogPayload = {
  event: "crawl_sync_jurisdiction"
  source: string
  status: "success" | "error"
  durationMs?: number
  created?: number
  updated?: number
  deleted?: number
  skipped?: number
  error?: string
}

function logStructured(payload: CrawlLogPayload): void {
  logger.json("info", payload)
}

function resolveSourceFilter(argv: string[]): string | undefined {
  const fromArg = argv.find((a) => a.startsWith("--source="))
  if (fromArg) {
    const value = fromArg.slice("--source=".length).trim()
    if (value) return value
  }
  const fromEnv = process.env.CRAWL_SOURCE?.trim()
  if (fromEnv) return fromEnv
  return undefined
}

async function syncOneJurisdiction(jurisdiction: {
  id: string
  source: string
  crawlUrl: string | null
}): Promise<void> {
  const crawlUrl = jurisdiction.crawlUrl
  if (!crawlUrl) {
    throw new Error(`Jurisdiction ${jurisdiction.source} has no crawlUrl`)
  }

  const result = await runCrawlSync({
    url: crawlUrl,
    source: jurisdiction.source,
  })

  await prisma.jurisdiction.update({
    where: { id: jurisdiction.id },
    data: {
      lastCrawlAt: new Date(),
      lastCrawlStatus: "success",
      lastCrawlError: null,
    },
  })

  logStructured({
    event: "crawl_sync_jurisdiction",
    source: jurisdiction.source,
    status: "success",
    durationMs: result.durationMs,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    skipped: result.skipped,
  })
}

async function main(): Promise<void> {
  const sourceFilter = resolveSourceFilter(process.argv.slice(2))

  // With an explicit source filter (onboarding), allow enabled=false so a first
  // crawl can run before the weekly job includes the row. Without a filter,
  // only enabled jurisdictions run (production / sync-all).
  const jurisdictions = await prisma.jurisdiction.findMany({
    where: {
      crawlUrl: { not: null },
      ...(sourceFilter
        ? { source: sourceFilter }
        : { enabled: true }),
    },
    orderBy: { source: "asc" },
  })

  if (jurisdictions.length === 0) {
    logger.json("info", {
      event: "crawl_sync_complete",
      status: "no_op",
      message: sourceFilter
        ? `No jurisdiction with crawlUrl for source=${sourceFilter}`
        : "No enabled jurisdictions with crawlUrl",
    })
    return
  }

  // Production: one Cloud Run Job execution per jurisdiction (CRAWL_SOURCE set).
  if (!sourceFilter && jurisdictions.length > 1) {
    logger.json("info", {
      event: "crawl_sync_warn",
      message:
        "CRAWL_SOURCE is unset; running all enabled jurisdictions sequentially. For production, use one job execution per source (parallel schedulers).",
      sources: jurisdictions.map((j) => j.source),
    })
  }

  if (sourceFilter && jurisdictions.length > 1) {
    logger.json("warn", {
      event: "crawl_sync_warn",
      message: `Multiple rows matched source=${sourceFilter}; syncing first only`,
    })
  }

  const toRun = sourceFilter ? jurisdictions.slice(0, 1) : jurisdictions

  logger.json("info", {
    event: "crawl_sync_start",
    count: toRun.length,
    sources: toRun.map((j) => j.source),
    mode: sourceFilter ? "single" : "sequential_all",
  })

  const failures: string[] = []

  for (const jurisdiction of toRun) {
    const startedAt = Date.now()
    try {
      await syncOneJurisdiction(jurisdiction)
    } catch (error: unknown) {
      const err = error as Error
      failures.push(jurisdiction.source)

      await prisma.jurisdiction.update({
        where: { id: jurisdiction.id },
        data: {
          lastCrawlAt: new Date(),
          lastCrawlStatus: "error",
          lastCrawlError: err.message?.slice(0, 4000) ?? "Unknown error",
        },
      })

      logStructured({
        event: "crawl_sync_jurisdiction",
        source: jurisdiction.source,
        status: "error",
        durationMs: Date.now() - startedAt,
        error: err.message,
      })
    }
  }

  logger.json("info", {
    event: "crawl_sync_complete",
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
    const err = error as Error
    logger.json("error", {
      event: "crawl_sync_fatal",
      status: "error",
      error: err.message,
      stack: err.stack,
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
