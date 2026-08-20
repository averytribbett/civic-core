/** OpenAI Realtime function tool definition for website search. */
export const SEARCH_WEBSITE_DOCUMENTS_TOOL = {
  type: "function" as const,
  name: "search_website_documents",
  description:
    "Semantic search over crawled municipality website chunks. Before calling, decide which department or service page would publish the answer, then search for that page topic—not the caller's exact words. Use for policies, fees, hours, contacts, permits, taxes, etc. If results are weak, call again with a different department/service phrase.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          'Short page-topic phrase, e.g. "property tax due dates", "building permit application", "county clerk office hours".',
      },
    },
    required: ["query"],
  },
}
