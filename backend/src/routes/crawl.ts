import { Router } from "express"
import { crawl } from "../controllers/crawl/crawl"

export const crawlRouter = Router()

crawlRouter.post("/", crawl)
