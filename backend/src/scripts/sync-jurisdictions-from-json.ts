import "dotenv/config"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { uploadLogoFile } from "../lib/logo-storage"
import { requireE164 } from "../lib/phone-number"

const MAX_LOGO_BYTES = 2 * 1024 * 1024

const DEFAULT_FILE = path.resolve(
  process.cwd(),
  "secrets",
  "jurisdictions.json",
)

const jurisdictionTypeSchema = z.enum([
  "country",
  "state",
  "county",
  "city",
  "township",
  "village",
])

const jurisdictionSchema = z.object({
  source: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: jurisdictionTypeSchema,
  email: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(1).nullable().optional(),
  /** E.164 AI inbound line — must include country code, e.g. +16515550100 */
  inboundPhoneNumber: z.string().trim().min(1).nullable().optional(),
  prompt: z.string().trim().min(1),
  crawlUrl: z.string().trim().url().nullable().optional(),
  faqUrl: z.string().trim().url().nullable().optional(),
  enabled: z.boolean().optional().default(false),
  /** Path to logo image (relative to the JSON file). Dev: copies locally + sets logoUrl. Prod (LOGO_STORAGE=gcs): uploads to bucket. */
  logoPath: z.string().trim().min(1).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use hex format like #8a2561")
    .optional(),
})

const fileSchema = z.object({
  jurisdictions: z.array(jurisdictionSchema),
})

type JurisdictionInput = z.infer<typeof jurisdictionSchema>

function resolveFilePath(argv: string[]): string {
  const fromArg = argv.find((a) => a.startsWith("--file="))
  if (fromArg) {
    const value = fromArg.slice("--file=".length).trim()
    if (value) return path.resolve(process.cwd(), value)
  }
  return DEFAULT_FILE
}

async function loadFile(filePath: string): Promise<JurisdictionInput[]> {
  let raw: string
  try {
    raw = await readFile(filePath, "utf8")
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      throw new Error(
        `File not found: ${filePath}\nCopy jurisdictions.json.example → secrets/jurisdictions.json and edit it.`,
      )
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`)
  }

  const result = fileSchema.safeParse(parsed)
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n")
    throw new Error(`Invalid jurisdictions file:\n${details}`)
  }

  const jurisdictions = result.data.jurisdictions
  const seen = new Set<string>()
  const seenInboundPhones = new Set<string>()
  for (const row of jurisdictions) {
    if (seen.has(row.source)) {
      throw new Error(`Duplicate source in JSON: ${row.source}`)
    }
    seen.add(row.source)

    if (row.inboundPhoneNumber?.trim()) {
      let e164: string
      try {
        e164 = requireE164(row.inboundPhoneNumber)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Invalid inboundPhoneNumber for "${row.source}": ${message}`,
        )
      }
      row.inboundPhoneNumber = e164
      if (seenInboundPhones.has(e164)) {
        throw new Error(`Duplicate inboundPhoneNumber in JSON: ${e164}`)
      }
      seenInboundPhones.add(e164)
    }
  }

  return jurisdictions
}

function dataFromInput(row: JurisdictionInput) {
  const data: {
    name: string
    type: JurisdictionInput["type"]
    email: string
    phoneNumber: string | null
    inboundPhoneNumber: string | null
    prompt: string
    crawlUrl: string | null
    faqUrl: string | null
    enabled: boolean
    logoUrl?: string
    themeColor?: string
  } = {
    name: row.name,
    type: row.type,
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    inboundPhoneNumber: row.inboundPhoneNumber ?? null,
    prompt: row.prompt,
    crawlUrl: row.crawlUrl ?? null,
    faqUrl: row.faqUrl ?? null,
    enabled: row.enabled ?? false,
  }
  if (row.themeColor) data.themeColor = row.themeColor
  return data
}

async function assertLogoFile(filePath: string): Promise<void> {
  const info = await stat(filePath)
  if (!info.isFile()) {
    throw new Error(`logoPath is not a file: ${filePath}`)
  }
  if (info.size > MAX_LOGO_BYTES) {
    throw new Error(
      `Logo too large (${info.size} bytes) at ${filePath}. Max is ${MAX_LOGO_BYTES} bytes.`,
    )
  }
}

async function resolveLogoUrl(
  row: JurisdictionInput,
  jsonDir: string,
): Promise<string | undefined> {
  if (!row.logoPath) return undefined
  const filePath = path.resolve(jsonDir, row.logoPath)
  await assertLogoFile(filePath)
  const { logoUrl } = await uploadLogoFile(row.source, filePath)
  return logoUrl
}

async function main(): Promise<void> {
  const filePath = resolveFilePath(process.argv.slice(2))
  console.log(`Syncing jurisdictions from ${filePath}`)

  const desired = await loadFile(filePath)
  const jsonDir = path.dirname(filePath)
  const desiredBySource = new Map(desired.map((j) => [j.source, j]))

  const existing = await prisma.jurisdiction.findMany({
    select: { id: true, source: true },
  })
  const existingBySource = new Map(existing.map((j) => [j.source, j]))

  const toCreate = desired.filter((j) => !existingBySource.has(j.source))
  const toUpdate = desired.filter((j) => existingBySource.has(j.source))
  const skippedInDb = existing.filter((j) => !desiredBySource.has(j.source))

  console.log(
    `Plan: create=${toCreate.length} update=${toUpdate.length} skipped_in_db=${skippedInDb.length}`,
  )

  if (skippedInDb.length > 0) {
    console.warn("")
    console.warn(
      "WARNING: The following jurisdictions exist in the database but are missing from the JSON file.",
    )
    console.warn("They will be left untouched (no delete).")
    for (const row of skippedInDb) {
      console.warn(`  - ${row.source}`)
    }
    console.warn("")
  }

  const logoUrlBySource = new Map<string, string>()
  for (const row of desired) {
    if (!row.logoPath) continue
    const logoUrl = await resolveLogoUrl(row, jsonDir)
    if (!logoUrl) {
      throw new Error(`Failed to resolve logo for ${row.source}`)
    }
    logoUrlBySource.set(row.source, logoUrl)
  }

  for (const [source, logoUrl] of logoUrlBySource) {
    console.log(`Logo ${source} → ${logoUrl}`)
  }

  await prisma.$transaction(async (tx) => {
    for (const row of toCreate) {
      const data = dataFromInput(row)
      const logoUrl = logoUrlBySource.get(row.source)
      if (logoUrl) data.logoUrl = logoUrl
      await tx.jurisdiction.create({
        data: {
          source: row.source,
          ...data,
        },
      })
    }

    for (const row of toUpdate) {
      const data = dataFromInput(row)
      const logoUrl = logoUrlBySource.get(row.source)
      if (logoUrl) data.logoUrl = logoUrl
      await tx.jurisdiction.update({
        where: { source: row.source },
        data,
      })
    }
  })

  console.log("Done.")
  if (toCreate.length > 0) {
    console.log(`Created: ${toCreate.map((j) => j.source).join(", ")}`)
  }
  if (toUpdate.length > 0) {
    console.log(`Updated: ${toUpdate.map((j) => j.source).join(", ")}`)
  }
}

main()
  .catch((error: unknown) => {
    const err = error as Error
    console.error(err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
