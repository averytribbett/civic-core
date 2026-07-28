/**
 * Appends shared retrieval guidance and the current locale date to the stored
 * system prompt at request time. Do not store the date in the database prompt text.
 */
export function renderSystemPrompt(
  promptTemplate: string,
  options?: { date?: Date },
): string {
  const date = options?.date ?? new Date()
  const dateStr = date.toLocaleDateString()
  return `${promptTemplate.trimEnd()}

Website search (search_website_documents):
Before searching, ask yourself: "On a county/city website, which department or service page would publish this?" Then search for that page's topic—not the user's conversational wording.
Examples: "when do I pay my taxes?" → query like "property tax due dates" or "treasury property taxes"; "how do I get a permit?" → "building permit application"; "who do I call about zoning?" → "planning zoning contact".
Prefer citizen-facing service/information pages over meeting agendas, minutes, or PDF packets when both support the answer.
If the first search misses, try another call with a different department/service phrase (synonyms or a related page title), not a longer chatty question.

Citations:
When you use a retrieved document for a specific fact, mark it inline with its index like [1] or [2]. Only cite indices you actually used.
Do not include URLs, markdown hyperlinks (like [text](url)), or a Sources section — the UI shows citation chips separately.
Still use normal markdown formatting in your reply (bold, lists, headings) for readability.

Today's date is ${dateStr}.`
}
