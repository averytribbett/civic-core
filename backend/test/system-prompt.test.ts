import assert from "node:assert/strict"
import test from "node:test"
import { formatPromptDate, renderSystemPrompt } from "../src/lib/system-prompt"

test("formatPromptDate includes weekday and timezone", () => {
  const date = new Date("2026-08-17T18:40:00.000Z")
  assert.equal(
    formatPromptDate(date, "America/Denver"),
    "Monday, August 17, 2026 (America/Denver)",
  )
})

test("renderSystemPrompt appends scheduling guidance and formatted date", () => {
  const date = new Date("2026-08-17T18:40:00.000Z")
  const prompt = renderSystemPrompt("You are a helpful assistant.", {
    date,
    timeZone: "America/Denver",
  })

  assert.match(prompt, /^You are a helpful assistant\./)
  assert.match(prompt, /Scheduling and "next meeting" questions:/)
  assert.match(
    prompt,
    /Today's date is Monday, August 17, 2026 \(America\/Denver\)\.$/,
  )
})
