import { Router } from "express"
import { getBranding } from "../controllers/widget/branding"

export const widgetRouter = Router()

widgetRouter.get("/branding", getBranding)
