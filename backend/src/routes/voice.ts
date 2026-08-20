import { Router, raw } from "express"
import { openAiVoiceWebhook } from "../controllers/voice/openai-webhook"
import { config } from "../config"

export const voiceRouter = Router()

voiceRouter.get("/health", (_req, res) => {
  res.json({ voice: config.features.voiceEnabled ? "enabled" : "disabled" })
})

/** OpenAI Realtime SIP webhook (raw body for signature verification). */
voiceRouter.post(
  "/openai/webhook",
  raw({ type: "application/json" }),
  (req, _res, next) => {
    ;(req as typeof req & { rawBody?: Buffer }).rawBody = req.body as Buffer
    next()
  },
  openAiVoiceWebhook,
)
