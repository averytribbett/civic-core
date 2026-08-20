import { Router, type RequestHandler } from "express"
import { chatRouter } from "./chat"
import { widgetRouter } from "./widget"
import { config } from "../config"

export const indexRouter = Router()

const voiceEnabled = config.features.voiceEnabled
const crawlDisabled = config.features.crawlDisabled
const devRoutesEnabled = config.features.devRoutesEnabled

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

// Local-only helpers (widget demo jurisdiction picker). Never set ENABLE_DEV_ROUTES on Cloud Run.
if (devRoutesEnabled) {
  // Lazy import keeps the production graph free of this route when the flag is off.
  let devRouterPromise: Promise<Router> | null = null
  function loadDevRouter(): Promise<Router> {
    if (!devRouterPromise) {
      devRouterPromise = import("./dev").then((m) => m.devRouter)
    }
    return devRouterPromise
  }

  const devEntry: RequestHandler = (req, res, next) => {
    void loadDevRouter()
      .then((router) => {
        ;(router as RequestHandler)(req, res, next)
      })
      .catch(next)
  }

  indexRouter.use("/dev", devEntry)
}

indexRouter.use("/widget", widgetRouter)
indexRouter.use("/chat", chatRouter)

if (voiceEnabled) {
  let voiceRouterPromise: Promise<import("express").Router> | null = null
  function loadVoiceRouter() {
    if (!voiceRouterPromise) {
      voiceRouterPromise = import("./voice").then((m) => m.voiceRouter)
    }
    return voiceRouterPromise
  }

  const voiceEntry: import("express").RequestHandler = (req, res, next) => {
    void loadVoiceRouter()
      .then((router) => {
        ;(router as import("express").RequestHandler)(req, res, next)
      })
      .catch(next)
  }

  indexRouter.use("/voice", voiceEntry)
}
