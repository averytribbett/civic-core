import assert from "node:assert/strict"
import test from "node:test"
import {
  calledNumberFromSipHeaders,
  normalizeE164,
  requireE164,
} from "../src/lib/phone-number"

test("requireE164 accepts valid E.164", () => {
  assert.equal(requireE164("+16515550100"), "+16515550100")
})

test("requireE164 throws on invalid or unnormalized input", () => {
  assert.throws(() => requireE164("6515550100"), /Invalid E\.164/)
  assert.throws(() => requireE164("(651) 555-0100"), /Invalid E\.164/)
  assert.throws(() => requireE164("123"), /Invalid E\.164/)
})

test("normalizeE164 formats messy runtime inputs for DB lookup", () => {
  assert.equal(normalizeE164("6515550100"), "+16515550100")
  assert.equal(normalizeE164("(651) 555-0100"), "+16515550100")
  assert.equal(normalizeE164("+16515550100"), "+16515550100")
  assert.equal(
    normalizeE164("sip:+16515550100@twilio.com"),
    "+16515550100",
  )
  assert.equal(
    normalizeE164("<sip:+16515550180@pstn.twilio.com>"),
    "+16515550180",
  )
})

test("normalizeE164 rejects OpenAI project URIs and garbage digit runs", () => {
  assert.equal(
    normalizeE164("sip:proj_abc123@sip.api.openai.com;transport=tls"),
    null,
  )
  assert.equal(normalizeE164("+0621575344695446617206"), null)
  assert.equal(normalizeE164("sip:621575344695446617206@host"), null)
})

test("calledNumberFromSipHeaders prefers Diversion over OpenAI To", () => {
  const number = calledNumberFromSipHeaders([
    {
      name: "To",
      value: "sip:proj_abc@sip.api.openai.com;transport=tls",
    },
    {
      name: "Diversion",
      value: "<sip:+16515550180@pstn.twilio.com>;reason=unconditional",
    },
    {
      name: "From",
      value: "sip:+15551234567@carrier.com",
    },
  ])
  assert.equal(number, "+16515550180")
})

test("calledNumberFromSipHeaders reads To when it is a PSTN number", () => {
  const number = calledNumberFromSipHeaders([
    { name: "From", value: "sip:+16515550199@example.com" },
    { name: "To", value: "sip:+16515550100@twilio.com" },
  ])
  assert.equal(number, "+16515550100")
})

test("calledNumberFromSipHeaders ignores caller P-Asserted-Identity", () => {
  const number = calledNumberFromSipHeaders([
    {
      name: "P-Asserted-Identity",
      value: "sip:+15559876543@twilio.com",
    },
    {
      name: "To",
      value: "sip:proj_abc@sip.api.openai.com",
    },
  ])
  assert.equal(number, null)
})

test("normalizeE164 returns null for empty input", () => {
  assert.equal(normalizeE164(""), null)
  assert.equal(normalizeE164(undefined), null)
})
