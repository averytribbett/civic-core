import { createLogger, isProductionLogging, safeLogText } from "../../lib/logger"
import {
  formatRetrievedDocumentsForVoice,
  retrieveWebsiteDocuments,
} from "../agent/retrieve-documents"

export async function executeSearchWebsiteDocuments(
  query: string,
  jurisdictionId: string,
  logSource?: string,
): Promise<string> {
  const log = createLogger("voice-tool", logSource)
  try {
    const queryPreview = safeLogText(query, 200)
    const queryLog = isProductionLogging()
      ? "query=(redacted)"
      : queryPreview
        ? `query=${JSON.stringify(queryPreview)}`
        : "query=(empty)"
    log.info(`search_website_documents ${queryLog}`)

    const chunks = await retrieveWebsiteDocuments(query, jurisdictionId, {
      logSource,
    })
    if (chunks.length === 0) {
      log.info(`search_website_documents: no documents found for ${queryLog}`)
    }
    return formatRetrievedDocumentsForVoice(chunks)
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error("search_website_documents error:", err)
    return `Error searching documents: ${err.message}`
  }
}
