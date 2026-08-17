import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import { createLogger, isProductionLogging, safeLogText } from "../../../lib/logger"
import {
  formatRetrievedDocuments,
  retrieveWebsiteDocuments,
} from "../retrieve-documents"
import type { SourcesCollector } from "../sources-collector"

export type SearchToolOptions = {
  /** Called at invoke time so the collector can be reset per chat turn. */
  getCollector?: () => SourcesCollector | undefined
  /** Slug for logs only. */
  logSource?: string
}

/**
 * Creates the search_website_documents tool, optionally scoped to a jurisdiction.
 * When jurisdictionId is provided, only chunks from that jurisdiction's documents are returned.
 */
export function createSearchWebsiteDocumentsTool(
  jurisdictionId?: string,
  options?: SearchToolOptions,
) {
  const log = createLogger("tools", options?.logSource)
  return new DynamicStructuredTool({
    name: "search_website_documents",
    description:
      "Semantic search over crawled website page chunks (embeddings + cosine similarity, not keyword/boolean search). Before calling, decide where on the jurisdiction website the answer would live (department or service page), then search for that page topic. Use for factual site details: policies, procedures, fees, hours, contacts, locations, etc. Prefer citing regular service/information pages over meeting agendas, minutes, or PDF packets when the same facts appear in both. If results are weak or empty, call again targeting a different department/service page phrase—not a longer conversational question. Cite results with [n] indices only; never put URLs or markdown hyperlinks in the user-facing answer. Still use normal markdown formatting (bold, lists) in the answer.",
    schema: z.object({
      query: z
        .string()
        .describe(
          'Semantic search string. Must name the website page or service topic where the answer would be published—not the user\'s chat question. Ask: "Which department/service page would have this?" Then write a short phrase matching that page (headings/titles), e.g. "property tax due dates", "building permit application", "county clerk office hours", "planning zoning contact". Do not copy the user message or add filler. Avoid AND/OR, quotes, site:. Avoid agenda/minutes/packet unless the user asked about meetings. One topic per call.',
        ),
    }),
    func: async ({ query }) => {
      try {
        const queryPreview = safeLogText(query, 200)
        const queryLog = isProductionLogging()
          ? "query=(redacted)"
          : queryPreview
            ? `query=${JSON.stringify(queryPreview)}`
            : "query=(empty)"
        log.info(`search_website_documents embedding ${queryLog}`)
        const chunks = await retrieveWebsiteDocuments(query, jurisdictionId, {
          logSource: options?.logSource,
        })
        if (chunks.length === 0) {
          log.info(`search_website_documents: no documents found for ${queryLog}`)
        } else {
          const urls = [
            ...new Set(chunks.map((chunk) => chunk.document.url)),
          ]
          log.info(
            `search_website_documents hits=${urls.length} ${queryLog} urls=${JSON.stringify(urls)}`,
          )
        }
        return formatRetrievedDocuments(chunks, options?.getCollector?.())
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        log.error("Error in search_documents tool:", err)
        return `Error searching documents: ${err.message}`
      }
    },
  })
}

/** Singleton tool with no jurisdiction filter (for backward compatibility / global search). */
export const searchWebsiteDocumentsTool = createSearchWebsiteDocumentsTool()
