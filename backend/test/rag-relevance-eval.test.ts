import assert from "node:assert/strict"
import test from "node:test"
import {
  formatEvalSummary,
  runRagRelevanceEval,
} from "../src/eval/rag-relevance/score"

test("citizen eval set reduces meeting-dump share vs similarity-only baseline", () => {
  const summary = runRagRelevanceEval()

  assert.equal(summary.cases.length, 4)
  assert.ok(
    summary.rankedMeetingDumpRate < summary.baselineMeetingDumpRate,
    `expected lower meeting_dump rate: ranked=${summary.rankedMeetingDumpRate} baseline=${summary.baselineMeetingDumpRate}\n${formatEvalSummary(summary)}`,
  )
  assert.ok(
    summary.rankedHtmlRate > summary.baselineHtmlRate,
    `expected higher html rate: ranked=${summary.rankedHtmlRate} baseline=${summary.baselineHtmlRate}\n${formatEvalSummary(summary)}`,
  )
  assert.equal(
    summary.casesImproved,
    summary.cases.length,
    `not all cases improved:\n${formatEvalSummary(summary)}`,
  )
})
