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
      "Search through available documents on the website to find relevant information. Use this tool when you need to find specific information from the website, such as details about policies, procedures, locations, or any factual information that might be stored in the documents.",
    schema: z.object({
      query: z
        .string()
        .describe("The search query to find relevant website document chunks"),
    }),
    func: async ({ query }) => {
      try {
        const chunks = await retrieveWebsiteDocuments(query, source)
        if (chunks.length === 0) {
          log.info("search_website_documents: no documents found for query")
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
