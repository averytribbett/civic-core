import assert from "node:assert/strict"
import test from "node:test"
import {
  buildChatPrompt,
  buildPrompt,
  buildVoiceGreetingInstructions,
  buildVoicePrompt,
  formatPromptDate,
} from "../src/config/prompts"

test("formatPromptDate includes weekday and timezone", () => {
  const date = new Date("2026-08-17T18:40:00.000Z")
  assert.equal(
    formatPromptDate(date, "America/Denver"),
    "Monday, August 17, 2026 (America/Denver)",
  )
})

test("buildChatPrompt appends scheduling guidance and formatted date", () => {
  const date = new Date("2026-08-17T18:40:00.000Z")
  const prompt = buildChatPrompt("You are a helpful assistant.", {
    date,
    timeZone: "America/Denver",
  })

  assert.match(prompt, /^You are a helpful assistant\./)
  assert.match(prompt, /Citations:/)
  assert.match(prompt, /Scheduling and "next meeting" questions:/)
  assert.match(
    prompt,
    /Today's date is Monday, August 17, 2026 \(America\/Denver\)\.$/,
  )
})

test("buildVoicePrompt shares date chunk with chat but uses voice rules", () => {
  const date = new Date("2026-08-17T18:40:00.000Z")
  const chat = buildChatPrompt("You assist Example County residents.", {
    date,
    timeZone: "America/Denver",
  })
  const voice = buildVoicePrompt("You assist Example County residents.", {
    date,
    timeZone: "America/Denver",
  })

  assert.match(voice, /Voice call rules \(spoken responses only\):/)
  assert.match(voice, /search_website_documents/)
  assert.match(voice, /No markdown/)
  assert.doesNotMatch(voice, /Citations:/)
  assert.match(
    voice,
    /Today's date is Monday, August 17, 2026 \(America\/Denver\)\.$/,
  )
  assert.match(chat, /Today's date is Monday, August 17, 2026 \(America\/Denver\)\.$/)
})

test("buildPrompt accepts channel explicitly", () => {
  const prompt = buildPrompt("Base.", "voice")
  assert.match(prompt, /Voice call rules/)
})

test("buildVoiceGreetingInstructions names the jurisdiction", () => {
  const instructions = buildVoiceGreetingInstructions("Chisago County")
  assert.match(instructions, /Chisago County/)
  assert.doesNotMatch(instructions, /their city or county/i)
})
