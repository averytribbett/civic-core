import { Router } from "express"
import { getBranding } from "../controllers/widget/branding"
import { getFaqs } from "../controllers/widget/faqs"

export const widgetRouter = Router()

widgetRouter.get("/branding", getBranding)
widgetRouter.get("/faqs", getFaqs)
