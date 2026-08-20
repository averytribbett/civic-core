import "dotenv/config"
import express, { Express, Request, Response } from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { indexRouter } from "./routes"
import { createLogger } from "./lib/logger"
import { getLocalLogosDir, getLogoStorageMode } from "./lib/logo-storage"
import { config } from "./config"
import path from "node:path"

const listenLog = createLogger("listen")

function listenPort(): number {
  return config.port
}

const app: Express = express()
const port = listenPort()

// Cloud Run (and other proxies) set X-Forwarded-*; required for express-rate-limit and correct req.ip.
app.set("trust proxy", 1)

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server")
})

app.use(helmet())

app.use(cors())

app.use((req, res, next) => {
  if (req.path === "/voice/openai/webhook") {
    return next()
  }
  return express.json()(req, res, next)
})

if (getLogoStorageMode() === "local") {
  const logosDir = getLocalLogosDir()
  app.use(
    "/assets/logos",
    express.static(logosDir, {
      maxAge: "365d",
      immutable: true,
      setHeaders(res) {
        res.set("Cache-Control", "public, max-age=31536000, immutable")
        // Widget shell is on a different origin (e.g. :5500) than the API (:4000).
        res.set("Cross-Origin-Resource-Policy", "cross-origin")
      },
    }),
  )
  listenLog.info(`Serving local logos from ${path.relative(process.cwd(), logosDir)} at /assets/logos/`)
}

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests", message: "Rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/chat", chatLimiter)

app.use("/", indexRouter)

const host = "0.0.0.0"
app.listen(port, host, () => {
  listenLog.info(
    `Server is listening on http://${host}:${port} (PORT env=${JSON.stringify(process.env.PORT)})`,
  )
})
