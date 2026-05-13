import type { Jurisdiction } from "../generated/prisma/client"

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireOrigin` after validating the widget origin and loading the jurisdiction. */
      jurisdiction?: Jurisdiction
    }
  }
}

export {}
