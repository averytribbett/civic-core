import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, "..", "hosting", "public")

const required = [
  "widget.js",
  "app/widget.html",
  "app/widget.css",
  "app/widget.js",
  "app/i18n.js",
  "app/locales/en.js",
]

let ok = true
for (const rel of required) {
  const p = path.join(publicDir, rel)
  try {
    await fs.access(p)
  } catch {
    console.error(`[verify-hosting] Missing: ${rel} (run npm run prepare-hosting first)`)
    ok = false
  }
}
if (!ok) process.exit(1)
console.log("[verify-hosting] All required assets present under hosting/public/")
