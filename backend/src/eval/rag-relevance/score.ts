import {
  rankAndDiversifyChunks,
  resolveDocKind,
  type DocumentKind,
  type RankableChunk,
} from "../../lib/document-kind"
import {
  CITIZEN_EVAL_CASES,
  type CitizenEvalCase,
} from "./citizen-questions"

export type CitationBucket = "html_page" | "meeting_dump" | "other_pdf" | "other"

export type MixRates = {
  total: number
  htmlPageRate: number
  meetingDumpRate: number
  otherPdfRate: number
  otherRate: number
  counts: Record<CitationBucket, number>
}

export type CaseEvalResult = {
  id: string
  category: CitizenEvalCase["category"]
  query: string
  baseline: MixRates
  ranked: MixRates
  /** Top-1 chunk kind after ranking (proxy for preferred citation). */
  baselineTopKind: DocumentKind
  rankedTopKind: DocumentKind
  /** True when ranked prefers HTML more and meeting dumps less. */
  improved: boolean
}

export type EvalSummary = {
  cases: CaseEvalResult[]
  baselineMeetingDumpRate: number
  rankedMeetingDumpRate: number
  baselineHtmlRate: number
  rankedHtmlRate: number
  casesImproved: number
}

function bucketForKind(kind: DocumentKind): CitationBucket {
  if (kind === "html_page") return "html_page"
  if (kind === "agenda" || kind === "minutes") return "meeting_dump"
  if (kind === "pdf") return "other_pdf"
  return "other"
}

/** Classify top-k retrieved chunks into HTML vs meeting-dump mix rates. */
export function measureCitationMix(
  chunks: RankableChunk[],
): MixRates {
  const counts: Record<CitationBucket, number> = {
    html_page: 0,
    meeting_dump: 0,
    other_pdf: 0,
    other: 0,
  }
  for (const chunk of chunks) {
    const kind = resolveDocKind({
      docKind: chunk.document.docKind,
      url: chunk.document.url,
      title: chunk.document.title,
      mimeType: chunk.document.mimeType,
    })
    counts[bucketForKind(kind)] += 1
  }
  const total = chunks.length || 1
  return {
    total: chunks.length,
    htmlPageRate: counts.html_page / total,
    meetingDumpRate: counts.meeting_dump / total,
    otherPdfRate: counts.other_pdf / total,
    otherRate: counts.other / total,
    counts,
  }
}

/** Baseline: top-k by raw cosine similarity only (no kind penalty / diversity). */
export function baselineTopK(
  chunks: RankableChunk[],
  limit = 5,
): RankableChunk[] {
  return [...chunks]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

export function evaluateCase(
  evalCase: CitizenEvalCase,
  options?: { limit?: number; maxChunksPerDocument?: number },
): CaseEvalResult {
  const limit = options?.limit ?? 5
  const maxChunksPerDocument = options?.maxChunksPerDocument ?? 2

  const baselineChunks = baselineTopK(evalCase.vectorHits, limit)
  const rankedChunks = rankAndDiversifyChunks(evalCase.vectorHits, {
    limit,
    maxChunksPerDocument,
  })

  const baseline = measureCitationMix(baselineChunks)
  const ranked = measureCitationMix(rankedChunks)

  const baselineTopKind = resolveDocKind({
    docKind: baselineChunks[0]?.document.docKind,
    url: baselineChunks[0]?.document.url ?? "",
    title: baselineChunks[0]?.document.title,
  })
  const rankedTopKind = resolveDocKind({
    docKind: rankedChunks[0]?.document.docKind,
    url: rankedChunks[0]?.document.url ?? "",
    title: rankedChunks[0]?.document.title,
  })

  const improved =
    ranked.htmlPageRate > baseline.htmlPageRate &&
    ranked.meetingDumpRate < baseline.meetingDumpRate

  return {
    id: evalCase.id,
    category: evalCase.category,
    query: evalCase.query,
    baseline,
    ranked,
    baselineTopKind,
    rankedTopKind,
    improved,
  }
}

export function runRagRelevanceEval(
  cases: CitizenEvalCase[] = CITIZEN_EVAL_CASES,
): EvalSummary {
  const results = cases.map((c) => evaluateCase(c))
  const n = results.length || 1
  const baselineMeetingDumpRate =
    results.reduce((s, r) => s + r.baseline.meetingDumpRate, 0) / n
  const rankedMeetingDumpRate =
    results.reduce((s, r) => s + r.ranked.meetingDumpRate, 0) / n
  const baselineHtmlRate =
    results.reduce((s, r) => s + r.baseline.htmlPageRate, 0) / n
  const rankedHtmlRate =
    results.reduce((s, r) => s + r.ranked.htmlPageRate, 0) / n

  return {
    cases: results,
    baselineMeetingDumpRate,
    rankedMeetingDumpRate,
    baselineHtmlRate,
    rankedHtmlRate,
    casesImproved: results.filter((r) => r.improved).length,
  }
}

export function formatEvalSummary(summary: EvalSummary): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const lines = [
    "RAG relevance eval (citizen questions)",
    `cases=${summary.cases.length} improved=${summary.casesImproved}`,
    `baseline  html=${pct(summary.baselineHtmlRate)} meeting_dump=${pct(summary.baselineMeetingDumpRate)}`,
    `ranked    html=${pct(summary.rankedHtmlRate)} meeting_dump=${pct(summary.rankedMeetingDumpRate)}`,
    "",
  ]
  for (const c of summary.cases) {
    lines.push(
      `${c.id} [${c.category}] improved=${c.improved} top ${c.baselineTopKind}→${c.rankedTopKind}`,
      `  query: ${c.query}`,
      `  baseline meeting_dump=${pct(c.baseline.meetingDumpRate)} html=${pct(c.baseline.htmlPageRate)}`,
      `  ranked   meeting_dump=${pct(c.ranked.meetingDumpRate)} html=${pct(c.ranked.htmlPageRate)}`,
    )
  }
  return lines.join("\n")
}
