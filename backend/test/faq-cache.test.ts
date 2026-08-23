import assert from "node:assert/strict"
import test from "node:test"
import {
  FAQ_SIMILARITY_THRESHOLD,
  isEnglishChatLanguage,
  normalizeFaqQuestion,
  pickBestUnusedFaq,
} from "../src/services/faq/faq.service"

test("normalizeFaqQuestion collapses punctuation and case", () => {
  assert.equal(
    normalizeFaqQuestion("  When are property taxes due?? "),
    "when are property taxes due",
  )
})

test("isEnglishChatLanguage treats missing and en locales as English", () => {
  assert.equal(isEnglishChatLanguage(undefined), true)
  assert.equal(isEnglishChatLanguage("en"), true)
  assert.equal(isEnglishChatLanguage("en-US"), true)
  assert.equal(isEnglishChatLanguage("es"), false)
})

test("pickBestUnusedFaq ignores used ids and scores below the threshold", () => {
  const hits = [
    { id: "used", similarity: 0.99 },
    { id: "low", similarity: 0.7 },
    { id: "best", similarity: 0.91 },
    { id: "ok", similarity: 0.86 },
  ]
  const picked = pickBestUnusedFaq(hits, ["used"], FAQ_SIMILARITY_THRESHOLD)
  assert.equal(picked?.id, "best")
  assert.equal(pickBestUnusedFaq(hits, ["used", "best", "ok"], 0.85), null)
})
