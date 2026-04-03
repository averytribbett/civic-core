import "dotenv/config"
import express, { Express, Request, Response } from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { indexRouter } from "./routes"

const app: Express = express()
const port = 4000

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server")
})

app.use(helmet())

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : null
app.use(
  cors(
    allowedOrigins?.length
      ? { origin: allowedOrigins }
      : undefined,
  ),
)

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
