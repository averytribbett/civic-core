import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import { createLogger } from "../../../lib/logger"
import {
  formatRetrievedDocuments,
  retrieveWebsiteDocuments,
} from "../retrieve-documents"

/**
 * Creates the search_website_documents tool, optionally scoped to a document source.
 * When source is provided, only chunks from documents with that source are returned (e2e consistency with chat source).
 */
export function createSearchWebsiteDocumentsTool(source?: string) {
  const log = createLogger("tools", source)
  return new DynamicStructuredTool({
    name: "search_website_documents",
    description:
      "Semantic search over crawled website page chunks (embeddings + cosine similarity, not keyword/boolean search). Before calling, decide where on the jurisdiction website the answer would live (department or service page), then search for that page topic. Use for factual site details: policies, procedures, fees, hours, contacts, locations, etc. Prefer citing regular service/information pages over meeting agendas, minutes, or PDF packets when the same facts appear in both. If results are weak or empty, call again targeting a different department/service page phrase—not a longer conversational question.",
    schema: z.object({
      query: z
        .string()
        .describe(
          'Semantic search string. Must name the website page or service topic where the answer would be published—not the user\'s chat question. Ask: "Which department/service page would have this?" Then write a short phrase matching that page (headings/titles), e.g. "property tax due dates", "building permit application", "county clerk office hours", "planning zoning contact". Do not copy the user message or add filler. Avoid AND/OR, quotes, site:. Avoid agenda/minutes/packet unless the user asked about meetings. One topic per call.',
        ),
    }),
    func: async ({ query }) => {
      try {
        const chunks = await retrieveWebsiteDocuments(query, source)
        if (chunks.length === 0) {
          log.info("search_website_documents: no documents found for query")
        } else {
          const urls = [
            ...new Set(chunks.map((chunk) => chunk.document.url)),
          ]
          log.info(
            `search_website_documents hits=${urls.length} urls=${JSON.stringify(urls)}`,
          )
        }
        return formatRetrievedDocuments(chunks)
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        log.error("Error in search_documents tool:", err)
        return `Error searching documents: ${err.message}`
      }
    },
  })
}

/** Singleton tool with no source filter (for backward compatibility / global search). */
export const searchWebsiteDocumentsTool = createSearchWebsiteDocumentsTool()
