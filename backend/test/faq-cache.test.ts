import assert from "node:assert/strict"
import test from "node:test"
import {
  FAQ_SIMILARITY_THRESHOLD,
  faqHasSources,
  isEnglishChatLanguage,
  isUsableCachedFaq,
  normalizeFaqQuestion,
  pickBestUnusedFaq,
  serializeFaqSources,
  usableFaqSources,
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

const sampleSource = {
  citationIndex: 1,
  url: "https://example.gov/taxes",
  title: "Taxes",
  heading: null,
  chunkIndex: 0,
  pageStart: null,
  pageEnd: null,
  mimeType: "text/html",
  snippet: "Due dates",
  href: "https://example.gov/taxes",
}

test("faqHasSources treats null and empty arrays as missing", () => {
  assert.equal(faqHasSources(null), false)
  assert.equal(faqHasSources(undefined), false)
  assert.equal(faqHasSources([]), false)
  assert.equal(faqHasSources([{ title: "no url" }]), false)
  assert.equal(faqHasSources([sampleSource]), true)
})

test("usableFaqSources and serializeFaqSources store null when none are found", () => {
  assert.equal(usableFaqSources([]), null)
  assert.equal(usableFaqSources(null), null)
  assert.equal(serializeFaqSources([]), null)
  assert.equal(serializeFaqSources(null), null)
  assert.deepEqual(usableFaqSources([sampleSource]), [sampleSource])
  assert.equal(
    serializeFaqSources([sampleSource]),
    JSON.stringify([sampleSource]),
  )
})

test("isUsableCachedFaq rejects cached answers with no sources", () => {
  assert.equal(isUsableCachedFaq({ sources: [] }), false)
  assert.equal(isUsableCachedFaq({ sources: [sampleSource] }), true)
})
