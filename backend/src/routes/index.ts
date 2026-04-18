import { Router, type RequestHandler } from "express"
import { chatRouter } from "./chat"

export const indexRouter = Router()

const crawlDisabled = process.env.DISABLE_CRAWL === "true"

if (crawlDisabled) {
  const crawlNotAvailable: RequestHandler = (_req, res) => {
    res.status(503).json({
      error: "Service unavailable",
      message:
        "Crawl is disabled in this environment (DISABLE_CRAWL=true). Run the crawler locally.",
    })
  }
  indexRouter.use("/crawl", crawlNotAvailable)
} else {
  // Lazy-load /crawl so `crawlee` is not imported during startup (large dependency graph;
  // Cloud Run TCP probe can fail if listen() happens too late).
  let crawlRouterPromise: Promise<Router> | null = null
  function loadCrawlRouter(): Promise<Router> {
    if (!crawlRouterPromise) {
      crawlRouterPromise = import("./crawl").then((m) => m.crawlRouter)
    }
    return crawlRouterPromise
  }

  const crawlEntry: RequestHandler = (req, res, next) => {
    void loadCrawlRouter()
      .then((router) => {
        ;(router as RequestHandler)(req, res, next)
      })
      .catch(next)
  }

  indexRouter.use("/crawl", crawlEntry)
}

indexRouter.use("/chat", chatRouter)
