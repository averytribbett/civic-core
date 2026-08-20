/** ITU E.164: leading +, country code 1–9, total 10–15 digits after +. */
const E164_PATTERN = /^\+[1-9]\d{9,14}$/

/** SIP headers to inspect for the called (Twilio) number, in priority order. */
const CALLED_NUMBER_HEADER_PRIORITY = [
  "diversion",
  "history-info",
  "to",
  "request-uri",
  "request-line",
] as const

/** Headers that identify the caller — not used for jurisdiction routing. */
const CALLER_HEADER_NAMES = new Set([
  "from",
  "p-asserted-identity",
  "remote-party-id",
  "contact",
])

/**
 * Validate E.164 for jurisdiction config (sync script). Throws if format is wrong.
 * JSON must already use E.164 — e.g. +16515550100.
 */
export function requireE164(raw: string): string {
  const trimmed = raw.trim()
  if (!E164_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid E.164 phone number "${raw}". Use format +16515550100.`,
    )
  }
  return trimmed
}

function isOpenAiProjectSipUser(user: string): boolean {
  const normalized = user.trim().toLowerCase()
  return normalized.startsWith("proj_") || normalized.startsWith("rtc_")
}

/** Pull the user/phone portion from a SIP/TEL header value. */
function sipUserPart(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const telMatch = trimmed.match(/<?tel:(\+?[0-9]+)>?/i)
  if (telMatch?.[1]) return telMatch[1]

  const sipMatch = trimmed.match(/<?sip:([^;>@]+)(?:@|>|;)/i)
  if (sipMatch?.[1]) return sipMatch[1].trim()

  const sipBare = trimmed.match(/<?sip:([^>]+)>?/i)
  if (sipBare?.[1]) return sipBare[1].split("@")[0]?.trim() ?? null

  return trimmed
}

/**
 * Best-effort normalize for runtime call routing (Twilio params, SIP headers).
 * Returns null unless the result is valid E.164.
 */
export function normalizeE164(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null

  const userPart = sipUserPart(raw) ?? raw.trim()
  if (!userPart || isOpenAiProjectSipUser(userPart)) return null

  if (E164_PATTERN.test(userPart)) return userPart

  const digits = userPart.replace(/\D/g, "")
  if (digits.length === 10) {
    const candidate = `+1${digits}`
    return E164_PATTERN.test(candidate) ? candidate : null
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const candidate = `+${digits}`
    return E164_PATTERN.test(candidate) ? candidate : null
  }
  if (digits.length >= 10 && digits.length <= 15 && !digits.startsWith("0")) {
    const candidate = `+${digits}`
    return E164_PATTERN.test(candidate) ? candidate : null
  }

  return null
}

function headerCandidates(
  headers: Array<{ name?: string; value?: string }>,
): Array<{ name: string; value: string }> {
  const byName = new Map<string, string[]>()
  for (const h of headers) {
    const name = h.name?.trim().toLowerCase()
    const value = h.value?.trim()
    if (!name || !value) continue
    if (CALLER_HEADER_NAMES.has(name)) continue
    const list = byName.get(name) ?? []
    list.push(value)
    byName.set(name, list)
  }

  const ordered: Array<{ name: string; value: string }> = []
  for (const name of CALLED_NUMBER_HEADER_PRIORITY) {
    for (const value of byName.get(name) ?? []) {
      ordered.push({ name, value })
    }
  }

  for (const [name, values] of byName) {
    if ((CALLED_NUMBER_HEADER_PRIORITY as readonly string[]).includes(name)) {
      continue
    }
    if (name.startsWith("x-")) {
      for (const value of values) {
        ordered.push({ name, value })
      }
    }
  }

  return ordered
}

/** Extract called number from OpenAI SIP headers array. */
export function calledNumberFromSipHeaders(
  headers: Array<{ name?: string; value?: string }> | undefined,
): string | null {
  if (!headers?.length) return null

  for (const { value } of headerCandidates(headers)) {
    const n = normalizeE164(value)
    if (n) return n
  }

  return null
}

/** For logs when routing fails — safe header names + truncated values. */
export function formatSipHeadersForLog(
  headers: Array<{ name?: string; value?: string }> | undefined,
): string {
  if (!headers?.length) return "(none)"
  return headers
    .map((h) => {
      const name = h.name ?? "?"
      const value = (h.value ?? "").slice(0, 120)
      return `${name}=${JSON.stringify(value)}`
    })
    .join("; ")
}
