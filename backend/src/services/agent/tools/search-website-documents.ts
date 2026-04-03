import { DynamicStructuredTool } from "@langchain/core/tools"
import { z } from "zod"
import { EmbeddingService } from "../../embedding.service"
import { DocumentService } from "../../document.service"
import { SourceType } from "../../../lib/types/system-prompt.types"

/**
 * Creates the search_website_documents tool, optionally scoped to a document source.
 * When source is provided, only chunks from documents with that source are returned (e2e consistency with chat source).
 */
export function createSearchWebsiteDocumentsTool(source?: SourceType) {
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
        const embeddingService = new EmbeddingService()
        const queryEmbedding = await embeddingService.generateEmbedding(query)

        const documentService = new DocumentService()
        const similarityThreshold = 0.6
        const chunkLimit = 5
        const initialChunks = await documentService.searchSimilarChunks(
          queryEmbedding,
          chunkLimit,
          similarityThreshold,
          source ?? undefined,
        )

        if (initialChunks.length === 0) {
          console.log(
            "[tools] search_website_documents: no documents found for query",
          )
          return "No relevant documents found for the query."
        }

        // Request ±1 adjacent chunks (same document, chunkIndex-1 and chunkIndex+1) when they exist
        const pairKeys = new Set<string>()
        const pairs: Array<{ documentId: string; chunkIndex: number }> = []
        const add = (documentId: string, chunkIndex: number) => {
          if (chunkIndex < 0) return
          const key = `${documentId}:${chunkIndex}`
          if (pairKeys.has(key)) return
          pairKeys.add(key)
          pairs.push({ documentId, chunkIndex })
        }
        for (const c of initialChunks) {
          const docId = c.document.id
          add(docId, c.chunkIndex - 1)
          add(docId, c.chunkIndex)
          add(docId, c.chunkIndex + 1)
        }
        const adjacentChunks = await documentService.getChunksByDocumentAndIndices(
          pairs,
          source ?? undefined,
        )
        type ChunkWithIndex = (typeof initialChunks)[0]
        const byKey = new Map<string, ChunkWithIndex>()
        for (const c of initialChunks) {
          byKey.set(`${c.document.id}:${c.chunkIndex}`, c)
        }
        for (const c of adjacentChunks) {
          const key = `${c.document.id}:${c.chunkIndex}`
          if (!byKey.has(key)) {
            byKey.set(key, { ...c, chunkIndex: c.chunkIndex } as ChunkWithIndex)
          }
        }
        const merged = Array.from(byKey.values()).sort(
          (a, b) =>
            a.document.id.localeCompare(b.document.id) ||
            (a.chunkIndex - b.chunkIndex),
        )
        const MAX_CHUNKS = 15
        const chunks = merged.slice(0, MAX_CHUNKS)

        const urls = [...new Set(chunks.map((c) => c.document.url))]
        console.log("[tools] search_website_documents: pulled documents", urls)

        const contextParts = chunks.map((chunk, index) => {
          const heading = chunk.heading ? `Heading: ${chunk.heading}\n` : ""
          return `[Document ${index + 1}]\nSource URL: ${chunk.document.url}${chunk.document.title ? `\nTitle: ${chunk.document.title}` : ""}\n${heading}${chunk.content}`
        })

        return `Found ${chunks.length} relevant document chunk(s). Use the content below to answer the user. Cite the Source URL when giving specific information.\n\n${contextParts.join("\n\n---\n\n")}`
      } catch (error: any) {
        console.error("Error in search_documents tool:", error)
        return `Error searching documents: ${error.message}`
      }
    },
  })
}

/** Singleton tool with no source filter (for backward compatibility / global search). */
export const searchWebsiteDocumentsTool = createSearchWebsiteDocumentsTool()
