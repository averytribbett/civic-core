import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const widgetRoot = path.resolve(__dirname, "..")
const outDir = path.join(widgetRoot, "hosting", "public")
const appSrc = path.join(widgetRoot, "app")
const launcherSrc = path.join(widgetRoot, "cdn", "widget.js")

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true })
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const e of entries) {
    const from = path.join(src, e.name)
    const to = path.join(dest, e.name)
    if (e.isDirectory()) await copyDir(from, to)
    else await fs.copyFile(from, to)
  }
}

await rmrf(outDir)
await fs.mkdir(path.join(outDir, "app"), { recursive: true })
await fs.copyFile(launcherSrc, path.join(outDir, "widget.js"))
await copyDir(appSrc, path.join(outDir, "app"))
console.log(`[prepare-hosting] Wrote ${path.relative(widgetRoot, outDir)}/ (widget.js + app/)`)
