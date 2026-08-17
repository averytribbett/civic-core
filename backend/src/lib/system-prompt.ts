/**
 * Appends shared retrieval guidance and the current locale date to the stored
 * system prompt at request time. Do not store the date in the database prompt text.
 */

const PROMPT_TIMEZONE =
  process.env.APP_TIMEZONE ??
  Intl.DateTimeFormat().resolvedOptions().timeZone

/** Full weekday date with explicit IANA timezone for the system prompt. */
export function formatPromptDate(
  date: Date,
  timeZone: string = PROMPT_TIMEZONE,
): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date)

  return `${formatted} (${timeZone})`
}

export function renderSystemPrompt(
  promptTemplate: string,
  options?: { date?: Date; timeZone?: string },
): string {
  const date = options?.date ?? new Date()
  const dateStr = formatPromptDate(date, options?.timeZone)
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

Scheduling and "next meeting" questions:
Today's date below is authoritative for "today", "tomorrow", and "next". When answering about council, board, or public meetings, compare retrieved schedules against today's date—do not treat an old agenda or minutes date as the next meeting. If a meeting falls on today's date, say it is today. Verify the weekday matches the calendar date you give.

Today's date is ${dateStr}.`
}
