import "dotenv/config"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { prisma } from "../lib/prisma"

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
  prompt: z.string().trim().min(1),
  crawlUrl: z.string().trim().url().nullable().optional(),
  enabled: z.boolean().optional().default(false),
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

async function confirmDeletes(sources: string[]): Promise<boolean> {
  console.warn("")
  console.warn(
    "WARNING: The following jurisdictions exist in the database but are missing from the JSON file.",
  )
  console.warn(
    "Continuing will DELETE these rows from jurisdiction (documents/conversations for those sources are not deleted).",
  )
  for (const source of sources) {
    console.warn(`  - ${source}`)
  }
  console.warn("")
  console.warn('Type y to delete them and continue. Anything else cancels (default).')

  const rl = createInterface({ input, output })
  try {
    const answer = (await rl.question("> ")).trim()
    return answer === "y"
  } finally {
    rl.close()
  }
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
  for (const row of jurisdictions) {
    if (seen.has(row.source)) {
      throw new Error(`Duplicate source in JSON: ${row.source}`)
    }
    seen.add(row.source)
  }

  return jurisdictions
}

function dataFromInput(row: JurisdictionInput) {
  return {
    name: row.name,
    type: row.type,
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    prompt: row.prompt,
    crawlUrl: row.crawlUrl ?? null,
    enabled: row.enabled ?? false,
  }
}

async function main(): Promise<void> {
  const filePath = resolveFilePath(process.argv.slice(2))
  console.log(`Syncing jurisdictions from ${filePath}`)

  const desired = await loadFile(filePath)
  const desiredBySource = new Map(desired.map((j) => [j.source, j]))

  const existing = await prisma.jurisdiction.findMany({
    select: { id: true, source: true },
  })
  const existingBySource = new Map(existing.map((j) => [j.source, j]))

  const toCreate = desired.filter((j) => !existingBySource.has(j.source))
  const toUpdate = desired.filter((j) => existingBySource.has(j.source))
  const toDelete = existing.filter((j) => !desiredBySource.has(j.source))

  console.log(
    `Plan: create=${toCreate.length} update=${toUpdate.length} delete=${toDelete.length}`,
  )

  if (toDelete.length > 0) {
    const confirmed = await confirmDeletes(toDelete.map((j) => j.source))
    if (!confirmed) {
      console.log("Cancelled. No changes were made.")
      return
    }
  }

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.jurisdiction.deleteMany({
        where: { source: { in: toDelete.map((j) => j.source) } },
      })
    }

    for (const row of toCreate) {
      await tx.jurisdiction.create({
        data: {
          source: row.source,
          ...dataFromInput(row),
        },
      })
    }

    for (const row of toUpdate) {
      await tx.jurisdiction.update({
        where: { source: row.source },
        data: dataFromInput(row),
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
  if (toDelete.length > 0) {
    console.log(`Deleted: ${toDelete.map((j) => j.source).join(", ")}`)
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
