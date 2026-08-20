import { config } from "./index"

export type BuildPromptOptions = {
  date?: Date
  timeZone?: string
}

export type PromptChannel = "chat" | "voice"

const SHARED_RETRIEVAL_GUIDANCE = `Website search (search_website_documents):
Before searching, ask yourself: "On a county/city website, which department or service page would publish this?" Then search for that page's topic—not the user's conversational wording.
Examples: "when do I pay my taxes?" → query like "property tax due dates" or "treasury property taxes"; "how do I get a permit?" → "building permit application"; "who do I call about zoning?" → "planning zoning contact".
Prefer citizen-facing service/information pages over meeting agendas, minutes, or PDF packets when both support the answer.
If the first search misses, try another call with a different department/service phrase (synonyms or a related page title), not a longer chatty question.`

// TODO: change this we shouldn't be scheduling anything
const SCHEDULING_GUIDANCE = `Scheduling and "next meeting" questions:
Today's date below is authoritative for "today", "tomorrow", and "next". When answering about council, board, or public meetings, compare retrieved schedules against today's date—do not treat an old agenda or minutes date as the next meeting. If a meeting falls on today's date, say it is today. Verify the weekday matches the calendar date you give.`

const CHAT_RULES = `Citations:
When you use a retrieved document for a specific fact, mark it inline with its index like [1] or [2]. Only cite indices you actually used.
Do not include URLs, markdown hyperlinks (like [text](url)), or a Sources section — the UI shows citation chips separately.
Still use normal markdown formatting in your reply (bold, lists, headings) for readability.`

const VOICE_RULES = `Voice call rules (spoken responses only):
- Speak in plain, conversational English. No markdown, bullet lists, URLs, or citation markers like [1].
- Keep each answer under about 45 seconds of speech unless the caller asks for more detail.
- You are the phone line for this municipality — be professional, warm, and concise like a helpful clerk.
- If you need facts from the website, call search_website_documents before answering. Say a brief filler like "Let me check the website for that" while searching.
- If you cannot find an answer, say so honestly and suggest visiting the official website or calling the main office during business hours.
- Do not make up phone numbers, fees, dates, or policies not supported by search results.
- For scheduling questions, use today's date from the system prompt to interpret "next meeting" and similar phrases.`

const CHANNEL_RULES: Record<PromptChannel, string> = {
  chat: CHAT_RULES,
  voice: VOICE_RULES,
}

/** Full weekday date with explicit IANA timezone for system prompts. */
export function formatPromptDate(
  date: Date,
  timeZone: string = config.app.timezone,
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

/**
 * Build a runtime system prompt from a jurisdiction DB template.
 * Shared retrieval + scheduling/date blocks are identical across channels;
 * channel-specific rules (chat citations vs voice speech) are appended in between.
 */
export function buildPrompt(
  promptTemplate: string,
  channel: PromptChannel,
  options?: BuildPromptOptions,
): string {
  const date = options?.date ?? new Date()
  const timeZone = options?.timeZone ?? config.app.timezone
  const dateStr = formatPromptDate(date, timeZone)

  return [
    promptTemplate.trimEnd(),
    SHARED_RETRIEVAL_GUIDANCE,
    CHANNEL_RULES[channel],
    SCHEDULING_GUIDANCE,
    `Today's date is ${dateStr}.`,
  ].join("\n\n")
}

export function buildChatPrompt(
  promptTemplate: string,
  options?: BuildPromptOptions,
): string {
  return buildPrompt(promptTemplate, "chat", options)
}

export function buildVoicePrompt(
  promptTemplate: string,
  options?: BuildPromptOptions,
): string {
  return buildPrompt(promptTemplate, "voice", options)
}
