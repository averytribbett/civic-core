import {
  formatEvalSummary,
  runRagRelevanceEval,
} from "./score"

const summary = runRagRelevanceEval()
console.log(formatEvalSummary(summary))

if (summary.rankedMeetingDumpRate >= summary.baselineMeetingDumpRate) {
  console.error(
    "FAIL: ranked meeting_dump rate did not decrease vs baseline",
  )
  process.exit(1)
}
if (summary.rankedHtmlRate <= summary.baselineHtmlRate) {
  console.error("FAIL: ranked html rate did not increase vs baseline")
  process.exit(1)
}
if (summary.casesImproved < summary.cases.length) {
  console.error(
    `FAIL: only ${summary.casesImproved}/${summary.cases.length} cases improved`,
  )
  process.exit(1)
}

console.log("PASS")
