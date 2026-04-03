import { Router } from "express"
import { crawlRouter } from "./crawl"
import { chatRouter } from "./chat"

export const indexRouter = Router()

indexRouter.use("/crawl", crawlRouter)
indexRouter.use("/chat", chatRouter)
