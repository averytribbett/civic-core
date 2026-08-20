import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { config, type LogoStorageMode } from "../config"

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"])
const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
}

export type { LogoStorageMode }

export function getLogoStorageMode(): LogoStorageMode {
  return config.logo.storage
}

export function getLocalLogosDir(): string {
  return path.resolve(process.cwd(), "secrets", "logos")
}

export function getLogoPublicBaseUrl(): string {
  return config.logo.publicBaseUrl
}

export function getGcsBucket(): string {
  const bucket = config.logo.gcsBucket
  if (!bucket) {
    throw new Error("GCS_ASSETS_BUCKET is required when LOGO_STORAGE=gcs")
  }
  return bucket
}

export function getGcsLogoPrefix(): string {
  return config.logo.gcsPrefix
}

export function assertValidLogoExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(
      `Unsupported image type "${ext || "(none)"}". Allowed: ${[...ALLOWED_EXT].join(", ")}`,
    )
  }
  return ext
}

export function mimeForExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream"
}

export function buildLocalLogoUrl(source: string, ext: string): string {
  const base = getLogoPublicBaseUrl()
  return `${base}/assets/logos/${source}${ext}`
}

export function buildGcsLogoUrl(source: string, ext: string): string {
  const bucket = getGcsBucket()
  const prefix = getGcsLogoPrefix()
  return `https://storage.googleapis.com/${bucket}/${prefix}/${source}${ext}`
}

export async function uploadLogoFile(
  source: string,
  filePath: string,
): Promise<{ logoUrl: string; ext: string }> {
  const ext = assertValidLogoExtension(filePath)
  const mode = getLogoStorageMode()

  if (mode === "local") {
    const dir = getLocalLogosDir()
    await mkdir(dir, { recursive: true })
    const dest = path.join(dir, `${source}${ext}`)
    await copyFile(filePath, dest)
    return { logoUrl: buildLocalLogoUrl(source, ext), ext }
  }

  const { Storage } = await import("@google-cloud/storage")
  const bucket = getGcsBucket()
  const prefix = getGcsLogoPrefix()
  const objectName = `${prefix}/${source}${ext}`
  const storage = new Storage()
  await storage.bucket(bucket).upload(filePath, {
    destination: objectName,
    metadata: {
      contentType: mimeForExtension(ext),
      cacheControl: "public, max-age=31536000, immutable",
    },
  })
  return { logoUrl: buildGcsLogoUrl(source, ext), ext }
}
