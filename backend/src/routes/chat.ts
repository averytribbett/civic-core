import { Router } from "express"
import { chat } from "../controllers/chat/chat"
import { voteMessage } from "../controllers/chat/vote"
import { requireOrigin } from "../lib/auth"

export const chatRouter = Router()

chatRouter.post("/", requireOrigin, chat)
chatRouter.post("/message/:messageId/vote", requireOrigin, voteMessage)
