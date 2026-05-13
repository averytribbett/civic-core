import "dotenv/config"
import express, { Express, Request, Response } from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { indexRouter } from "./routes"

function listenPort(): number {
  const raw = process.env.PORT
  if (raw === undefined || raw === "") {
    return 4000
  }
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    console.error(`[listen] Invalid PORT=${JSON.stringify(raw)}, using 4000`)
    return 4000
  }
  return n
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

app.use(express.json())

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
  console.log(
    `[listen] Server is listening on http://${host}:${port} (PORT env=${JSON.stringify(process.env.PORT)})`,
  )
})
