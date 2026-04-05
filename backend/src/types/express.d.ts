import type { Jurisdiction } from "../generated/prisma/client"

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireOrigin` after validating the request against the jurisdiction's allowed origins. */
      jurisdiction?: Jurisdiction
    }
  }
}

export {}
