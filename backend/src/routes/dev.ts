import { Router } from "express"
import { listJurisdictions } from "../controllers/dev/list-jurisdictions"

export const devRouter = Router()

devRouter.get("/jurisdictions", listJurisdictions)
